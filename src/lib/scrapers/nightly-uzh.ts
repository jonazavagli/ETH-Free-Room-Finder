import fs from 'fs';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { parseUzh3vroomsCalendarPayload, parseUzhStudyRoomsPayload } from './uzh';
import { zurichLocalToIso } from '@/lib/time';
import { Booking, Building, Room } from '@/types/domain';

export interface UzhCampusCalendarInput {
  campus: string;
  rawCalendarJson: unknown;
}

export interface UzhScrapeSummary {
  runId: number;
  verdict: 'ok' | 'partial' | 'quarantined' | 'failed';
  studyRoomsUpserted: number;
  teachingRoomsUpserted: number;
  bookingsWritten: number;
  errors: Array<{ context: string; error: string }>;
}

/**
 * Upserts the 19 static UZH student study areas from `fixtures/uzh-study-rooms.json`.
 */
export async function syncUzhStaticStudyRooms(
  supabase: SupabaseClient
): Promise<{ buildingsCount: number; studyRoomsCount: number }> {
  const fixturePath = path.resolve(process.cwd(), 'fixtures/uzh-study-rooms.json');
  const rawText = fs.readFileSync(fixturePath, 'utf-8');
  const rawJson: unknown = JSON.parse(rawText);

  const { buildings, rooms } = parseUzhStudyRoomsPayload(rawJson);

  if (buildings.length > 0) {
    const { error: bErr } = await supabase
      .from('buildings')
      .upsert(buildings, { onConflict: 'id' });
    if (bErr) {
      throw new Error(`Failed to upsert UZH study buildings: ${bErr.message}`);
    }
  }

  if (rooms.length > 0) {
    const { error: rErr } = await supabase.from('rooms').upsert(
      rooms.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      { onConflict: 'id' }
    );
    if (rErr) {
      throw new Error(`Failed to upsert UZH study rooms: ${rErr.message}`);
    }
  }

  return {
    buildingsCount: buildings.length,
    studyRoomsCount: rooms.length,
  };
}

/**
 * Validates and persists UZH 3vrooms campus calendar payloads + static study rooms into Supabase.
 */
export async function persistUzhCalendarPayloads(
  supabase: SupabaseClient,
  campusInputs: UzhCampusCalendarInput[],
  fromYYYYMMDD: string,
  toYYYYMMDD: string
): Promise<UzhScrapeSummary> {
  const startedAtIso = new Date().toISOString();

  const { data: runRow, error: runInitErr } = await supabase
    .from('scrape_runs')
    .insert({
      source: 'uzh_3vrooms',
      started_at: startedAtIso,
      verdict: 'running',
    })
    .select('id')
    .single();

  if (runInitErr || !runRow) {
    throw new Error(`Could not create UZH scrape_runs record: ${runInitErr?.message}`);
  }

  const runId = runRow.id as number;
  const errors: Array<{ context: string; error: string }> = [];

  try {
    const staticRes = await syncUzhStaticStudyRooms(supabase);

    const allBuildingsMap = new Map<string, Building>();
    const allRoomsMap = new Map<string, Room>();
    const allBookingsByRoom = new Map<string, Booking[]>();
    const scrapedAtIso = new Date().toISOString();

    for (const input of campusInputs) {
      try {
        const parsed = parseUzh3vroomsCalendarPayload(
          input.rawCalendarJson,
          input.campus,
          scrapedAtIso
        );

        for (const b of parsed.buildings) {
          allBuildingsMap.set(b.id, b);
        }
        for (const r of parsed.rooms) {
          allRoomsMap.set(r.id, r);
        }
        for (const [roomId, list] of parsed.bookingsByRoomId.entries()) {
          const prev = allBookingsByRoom.get(roomId) ?? [];
          // Deduplicate identical start_time + end_time blocks
          const seen = new Set(prev.map((x) => `${x.start_time}|${x.end_time}`));
          for (const item of list) {
            const key = `${item.start_time}|${item.end_time}`;
            if (!seen.has(key)) {
              seen.add(key);
              prev.push(item);
            }
          }
          allBookingsByRoom.set(roomId, prev);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ context: input.campus, error: msg });
      }
    }

    const buildings = Array.from(allBuildingsMap.values());
    const rooms = Array.from(allRoomsMap.values());

    if (rooms.length === 0) {
      await supabase
        .from('scrape_runs')
        .update({
          finished_at: new Date().toISOString(),
          rooms_succeeded: 0,
          rooms_failed: errors.length || 1,
          bookings_written: 0,
          errors,
          verdict: 'failed',
        })
        .eq('id', runId);

      return {
        runId,
        verdict: 'failed',
        studyRoomsUpserted: staticRes.studyRoomsCount,
        teachingRoomsUpserted: 0,
        bookingsWritten: 0,
        errors,
      };
    }

    // Upsert buildings & rooms
    if (buildings.length > 0) {
      const { error: bErr } = await supabase
        .from('buildings')
        .upsert(buildings, { onConflict: 'id' });
      if (bErr) {
        throw new Error(`Failed to upsert UZH buildings: ${bErr.message}`);
      }
    }

    const { error: rErr } = await supabase.from('rooms').upsert(
      rooms.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      { onConflict: 'id' }
    );
    if (rErr) {
      throw new Error(`Failed to upsert UZH rooms: ${rErr.message}`);
    }

    const windowStartIso = zurichLocalToIso(fromYYYYMMDD, '00:00:00');
    const windowEndIso = zurichLocalToIso(toYYYYMMDD, '24:00:00');

    // Suspicious-run quarantine check
    const roomIds = rooms.map((r) => r.id);
    const { count: priorCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('room_id', roomIds)
      .gte('start_time', windowStartIso)
      .lt('start_time', windowEndIso);

    const stagedTotalBookings = Array.from(allBookingsByRoom.values()).reduce(
      (acc, list) => acc + list.length,
      0
    );

    if (priorCount && priorCount >= 40 && stagedTotalBookings < priorCount * 0.25) {
      await supabase
        .from('scrape_runs')
        .update({
          finished_at: new Date().toISOString(),
          rooms_succeeded: rooms.length,
          rooms_failed: errors.length,
          bookings_written: 0,
          errors: [
            ...errors,
            {
              context: 'quarantine',
              error: `Bookings dropped from ${priorCount} to ${stagedTotalBookings}`,
            },
          ],
          verdict: 'quarantined',
        })
        .eq('id', runId);

      return {
        runId,
        verdict: 'quarantined',
        studyRoomsUpserted: staticRes.studyRoomsCount,
        teachingRoomsUpserted: rooms.length,
        bookingsWritten: 0,
        errors,
      };
    }

    // Write each room's bookings transactionally via RPC
    let totalBookingsWritten = 0;
    let roomsSucceeded = 0;

    for (const room of rooms) {
      const roomBookings = allBookingsByRoom.get(room.id) ?? [];
      const { data: insertedCount, error: rpcErr } = await supabase.rpc(
        'replace_room_bookings_for_window',
        {
          p_room_id: room.id,
          p_window_start: windowStartIso,
          p_window_end: windowEndIso,
          p_source: 'uzh_3vrooms',
          p_scraped_at: scrapedAtIso,
          p_schedule_status: 'ok',
          p_bookings: roomBookings,
        }
      );

      if (rpcErr) {
        errors.push({ context: room.id, error: rpcErr.message });
      } else {
        roomsSucceeded++;
        totalBookingsWritten += Number(insertedCount ?? roomBookings.length);
      }
    }

    const verdict: 'ok' | 'partial' = errors.length === 0 ? 'ok' : 'partial';

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
      studyRoomsUpserted: staticRes.studyRoomsCount,
      teachingRoomsUpserted: roomsSucceeded,
      bookingsWritten: totalBookingsWritten,
      errors,
    };
  } catch (fatalErr) {
    const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    await supabase
      .from('scrape_runs')
      .update({
        finished_at: new Date().toISOString(),
        errors: [...errors, { context: 'SYSTEM', error: msg }],
        verdict: 'failed',
      })
      .eq('id', runId);
    throw fatalErr;
  }
}
