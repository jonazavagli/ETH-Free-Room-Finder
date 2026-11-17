import { SupabaseClient } from '@supabase/supabase-js';
import { fetchEthRoomAllocations, fetchEthRoomsList, sleep } from './eth';
import { fetchEthStudySpacesAvailability } from './eth-studyspaces';
import { addDaysYYYYMMDD, getZurichDateYYYYMMDD, zurichLocalToIso } from '@/lib/time';
import { Booking, Building } from '@/types/domain';

export interface EthScrapeBatchOptions {
  batchSize?: number;
  delayMs?: number;
  maxRuntimeMs?: number;
  syncRoomList?: boolean;
  buildingFilter?: string[]; // Optional filter (e.g. ['HG', 'CAB', 'HIL']) for targeted runs
  cohortHours?: number; // Default 44h for Option A (48h alternating cohorts)
}

export interface EthScrapeBatchSummary {
  runId: number;
  verdict: 'ok' | 'partial' | 'quarantined' | 'failed';
  roomsAttempted: number;
  roomsSucceeded: number;
  roomsFailed: number;
  bookingsWritten: number;
  errors: Array<{ roomId: string; error: string }>;
  remainingDueInQueue: number;
}

/**
 * Ensures ETH buildings, teaching rooms, and scrape_queue entries exist in Supabase.
 */
export async function syncEthCatalogToDatabase(
  supabase: SupabaseClient
): Promise<{ buildingsUpserted: number; roomsUpserted: number }> {
  const [{ buildings, rooms }, studySpacesRes] = await Promise.all([
    fetchEthRoomsList(),
    fetchEthStudySpacesAvailability(),
  ]);

  const mergedBuildingsMap = new Map<string, Building>();
  for (const b of buildings) {
    mergedBuildingsMap.set(b.id, b);
  }
  for (const b of studySpacesRes.buildings) {
    if (!mergedBuildingsMap.has(b.id)) {
      mergedBuildingsMap.set(b.id, b);
    }
  }
  const allBuildings = Array.from(mergedBuildingsMap.values());

  if (allBuildings.length > 0) {
    const { error: bErr } = await supabase
      .from('buildings')
      .upsert(allBuildings, { onConflict: 'id' });
    if (bErr) {
      throw new Error(`Failed to upsert ETH buildings: ${bErr.message}`);
    }
  }

  // Fetch existing rooms so we don't overwrite schedule_status / last_scraped_at
  const { data: existingRooms, error: exErr } = await supabase
    .from('rooms')
    .select('id, schedule_status, last_scraped_at')
    .eq('institution', 'ETH');

  if (exErr) {
    throw new Error(`Failed to read existing ETH rooms: ${exErr.message}`);
  }

  const existingMap = new Map<
    string,
    { schedule_status: string; last_scraped_at: string | null }
  >();
  for (const r of existingRooms ?? []) {
    existingMap.set(r.id as string, {
      schedule_status: r.schedule_status as string,
      last_scraped_at: r.last_scraped_at as string | null,
    });
  }

  const studySpaceByRoomId = new Map(studySpacesRes.rooms.map((sr) => [sr.id, sr]));
  const teachingRoomIds = new Set(rooms.map((r) => r.id));
  const roomsToUpsert = [
    ...rooms.map((r) => {
      const existing = existingMap.get(r.id);
      const matchingStudySpace = studySpaceByRoomId.get(r.id);
      return {
        ...r,
        live_occupancy_key: matchingStudySpace?.live_occupancy_key ?? r.live_occupancy_key,
        schedule_status: existing ? existing.schedule_status : r.schedule_status,
        last_scraped_at: existing ? existing.last_scraped_at : r.last_scraped_at,
        updated_at: new Date().toISOString(),
      };
    }),
    ...studySpacesRes.rooms
      .filter((sr) => !teachingRoomIds.has(sr.id))
      .map((sr) => ({
        ...sr,
        updated_at: new Date().toISOString(),
      })),
  ];

  if (roomsToUpsert.length > 0) {
    const { error: rErr } = await supabase
      .from('rooms')
      .upsert(roomsToUpsert, { onConflict: 'id' });
    if (rErr) {
      throw new Error(`Failed to upsert ETH rooms: ${rErr.message}`);
    }
  }

  // Populate scrape_queue for any room not yet in the queue
  const { data: existingQueue } = await supabase
    .from('scrape_queue')
    .select('room_id')
    .eq('source', 'eth_rauminfo');

  const queuedIds = new Set((existingQueue ?? []).map((q) => q.room_id as string));

  const newQueueRows = rooms
    .filter((r) => !queuedIds.has(r.id))
    .map((r, idx) => ({
      room_id: r.id,
      source: 'eth_rauminfo',
      cohort: idx % 2,
      next_scrape_after: new Date().toISOString(),
    }));

  if (newQueueRows.length > 0) {
    const { error: qErr } = await supabase
      .from('scrape_queue')
      .upsert(newQueueRows, { onConflict: 'room_id' });
    if (qErr) {
      throw new Error(`Failed to seed scrape_queue: ${qErr.message}`);
    }
  }

  return {
    buildingsUpserted: allBuildings.length,
    roomsUpserted: roomsToUpsert.length,
  };
}

/**
 * Executes one polite, resumable batch of ETH room allocation scraping.
 */
export async function runEthScrapeBatch(
  supabase: SupabaseClient,
  options: EthScrapeBatchOptions = {}
): Promise<EthScrapeBatchSummary> {
  const batchSize = options.batchSize ?? 50;
  const delayMs = Math.max(1000, options.delayMs ?? 1200);
  const maxRuntimeMs = options.maxRuntimeMs ?? 240_000;
  const cohortHours = options.cohortHours ?? 30;
  const startTimeMs = Date.now();

  // Create scrape_runs entry
  const { data: runRow, error: runInitErr } = await supabase
    .from('scrape_runs')
    .insert({
      source: 'eth_rauminfo',
      started_at: new Date(startTimeMs).toISOString(),
      verdict: 'running',
    })
    .select('id')
    .single();

  if (runInitErr || !runRow) {
    throw new Error(`Could not create scrape_runs record: ${runInitErr?.message}`);
  }

  const runId = runRow.id as number;
  const errors: Array<{ roomId: string; error: string }> = [];

  try {
    // Check if we need to sync the room catalog first
    const { count: roomCount } = await supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('institution', 'ETH');

    if (options.syncRoomList || !roomCount || roomCount === 0) {
      await syncEthCatalogToDatabase(supabase);
    }

    const nowIso = new Date().toISOString();

    // Select due queue items joined with rooms
    let queueQuery = supabase
      .from('scrape_queue')
      .select('room_id, cohort, rooms!inner(id, display_name, building_code)')
      .eq('source', 'eth_rauminfo')
      .lte('next_scrape_after', nowIso)
      .order('next_scrape_after', { ascending: true })
      .limit(batchSize);

    if (options.buildingFilter && options.buildingFilter.length > 0) {
      queueQuery = queueQuery.in('rooms.building_code', options.buildingFilter);
    }

    const { data: dueItems, error: dueErr } = await queueQuery;
    if (dueErr) {
      throw new Error(`Failed to query scrape_queue: ${dueErr.message}`);
    }

    const items = (dueItems ?? []) as Array<{
      room_id: string;
      cohort: number;
      rooms:
        | { id: string; display_name: string; building_code: string }
        | Array<{ id: string; display_name: string; building_code: string }>;
    }>;

    // 7-day look-ahead window: today .. today + 6 days in Europe/Zurich
    const todayYYYYMMDD = getZurichDateYYYYMMDD(startTimeMs);
    const endYYYYMMDD = addDaysYYYYMMDD(todayYYYYMMDD, 6);
    const windowStartIso = zurichLocalToIso(todayYYYYMMDD, '00:00:00');
    const windowEndIso = zurichLocalToIso(endYYYYMMDD, '24:00:00');

    const stagedResults: Array<{
      roomId: string;
      bookings: Booking[];
      scrapedAtIso: string;
    }> = [];

    let consecutiveFailures = 0;

    for (let i = 0; i < items.length; i++) {
      if (Date.now() - startTimeMs > maxRuntimeMs) {
        break;
      }

      const item = items[i]!;
      const roomObj = Array.isArray(item.rooms) ? item.rooms[0] : item.rooms;
      if (!roomObj) continue;

      if (i > 0) {
        await sleep(delayMs);
      }

      const scrapedAtIso = new Date().toISOString();
      try {
        const bookings = await fetchEthRoomAllocations(
          roomObj.display_name,
          roomObj.id,
          todayYYYYMMDD,
          endYYYYMMDD,
          scrapedAtIso
        );
        stagedResults.push({
          roomId: roomObj.id,
          bookings,
          scrapedAtIso,
        });
        consecutiveFailures = 0;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ roomId: roomObj.id, error: message });
        consecutiveFailures++;

        await supabase
          .from('scrape_queue')
          .update({
            last_attempt_at: scrapedAtIso,
            last_status: 'failed',
            last_error: message,
            // Retry failed room in 2 hours instead of immediately hammering
            next_scrape_after: new Date(Date.now() + 2 * 3600_000).toISOString(),
          })
          .eq('room_id', roomObj.id);

        // Polite backoff & abort after 5 consecutive failures
        if (consecutiveFailures >= 5) {
          break;
        }
        await sleep(delayMs * 2);
      }
    }

    const roomsAttempted = stagedResults.length + errors.length;
    const roomsSucceeded = stagedResults.length;
    const roomsFailed = errors.length;

    // Suspicious run quarantine check (Section 6)
    const highFailureRate = roomsAttempted >= 5 && roomsFailed / roomsAttempted > 0.4;

    let sharpBookingDrop = false;
    if (roomsSucceeded >= 10) {
      const succeededRoomIds = stagedResults.map((r) => r.roomId);
      const { count: priorCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('room_id', succeededRoomIds)
        .gte('start_time', windowStartIso)
        .lt('start_time', windowEndIso);

      const newTotal = stagedResults.reduce((acc, r) => acc + r.bookings.length, 0);
      if (priorCount && priorCount >= 30 && newTotal < priorCount * 0.25) {
        sharpBookingDrop = true;
      }
    }

    if (highFailureRate || sharpBookingDrop) {
      const verdict = 'quarantined';
      await supabase
        .from('scrape_runs')
        .update({
          finished_at: new Date().toISOString(),
          rooms_succeeded: roomsSucceeded,
          rooms_failed: roomsFailed,
          bookings_written: 0,
          errors,
          verdict,
        })
        .eq('id', runId);

      return {
        runId,
        verdict,
        roomsAttempted,
        roomsSucceeded,
        roomsFailed,
        bookingsWritten: 0,
        errors,
        remainingDueInQueue: 0,
      };
    }

    // Commit each validated room's 7-day bookings atomically via RPC
    let totalBookingsWritten = 0;
    const nextScrapeAfterIso = new Date(Date.now() + cohortHours * 3600_000).toISOString();

    for (const res of stagedResults) {
      const { data: insertedCount, error: rpcErr } = await supabase.rpc(
        'replace_room_bookings_for_window',
        {
          p_room_id: res.roomId,
          p_window_start: windowStartIso,
          p_window_end: windowEndIso,
          p_source: 'eth_rauminfo',
          p_scraped_at: res.scrapedAtIso,
          p_schedule_status: 'ok',
          p_bookings: res.bookings,
        }
      );

      if (rpcErr) {
        errors.push({ roomId: res.roomId, error: `RPC error: ${rpcErr.message}` });
      } else {
        totalBookingsWritten += Number(insertedCount ?? res.bookings.length);
        await supabase
          .from('scrape_queue')
          .update({
            last_attempt_at: res.scrapedAtIso,
            last_status: 'ok',
            last_error: null,
            next_scrape_after: nextScrapeAfterIso,
          })
          .eq('room_id', res.roomId);
      }
    }

    const { count: remainingDue } = await supabase
      .from('scrape_queue')
      .select('room_id', { count: 'exact', head: true })
      .eq('source', 'eth_rauminfo')
      .lte('next_scrape_after', new Date().toISOString());

    const verdict: 'ok' | 'partial' | 'failed' =
      roomsFailed === 0 ? 'ok' : roomsSucceeded > 0 ? 'partial' : 'failed';

    await supabase
      .from('scrape_runs')
      .update({
        finished_at: new Date().toISOString(),
        rooms_succeeded: roomsSucceeded,
        rooms_failed: errors.length,
        bookings_written: totalBookingsWritten,
        errors,
        verdict,
      })
      .eq('id', runId);

    return {
      runId,
      verdict,
      roomsAttempted,
      roomsSucceeded,
      roomsFailed: errors.length,
      bookingsWritten: totalBookingsWritten,
      errors,
      remainingDueInQueue: remainingDue ?? 0,
    };
  } catch (fatalErr) {
    const message = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    errors.push({ roomId: 'SYSTEM', error: message });
    await supabase
      .from('scrape_runs')
      .update({
        finished_at: new Date().toISOString(),
        errors,
        verdict: 'failed',
      })
      .eq('id', runId);
    throw fatalErr;
  }
}
