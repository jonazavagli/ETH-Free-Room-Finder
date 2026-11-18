import fs from 'fs';
import https from 'node:https';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { getPoliteUserAgent, sleep } from './eth';
import {
  parseUzh3vroomsCalendarPayload,
  parseUzhStudyRoomsPayload,
  UZH_3VROOMS_PORTAL_URL,
  UZH_CAMPUS_FILTER_SETTINGS,
} from './uzh';
import { addDaysYYYYMMDD, getZurichDateYYYYMMDD, zurichLocalToIso } from '@/lib/time';
import { Booking, Building, Room, RoomOfficialDetails } from '@/types/domain';

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
    const { data: existingUzhRooms } = await supabase
      .from('rooms')
      .select('id, official_details')
      .eq('institution', 'UZH');
    const existingDetailsById = new Map<string, RoomOfficialDetails>();
    for (const er of existingUzhRooms ?? []) {
      if (er.official_details) {
        existingDetailsById.set(er.id as string, er.official_details as RoomOfficialDetails);
      }
    }

    const { error: rErr } = await supabase.from('rooms').upsert(
      rooms.map((r) => ({
        ...r,
        official_details: {
          ...r.official_details,
          ...(existingDetailsById.get(r.id) ?? {}),
        },
        updated_at: new Date().toISOString(),
      })),
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

    const { data: existingUzhRooms } = await supabase
      .from('rooms')
      .select('id, official_details')
      .eq('institution', 'UZH');
    const existingDetailsById = new Map<string, RoomOfficialDetails>();
    for (const er of existingUzhRooms ?? []) {
      if (er.official_details) {
        existingDetailsById.set(er.id as string, er.official_details as RoomOfficialDetails);
      }
    }

    const { error: rErr } = await supabase.from('rooms').upsert(
      rooms.map((r) => ({
        ...r,
        official_details: {
          ...r.official_details,
          ...(existingDetailsById.get(r.id) ?? {}),
        },
        updated_at: new Date().toISOString(),
      })),
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

    // Prune expired historical bookings that ended more than 48 hours ago
    const retentionCutoffIso = new Date(Date.now() - 48 * 3600_000).toISOString();
    await supabase.from('bookings').delete().lt('end_time', retentionCutoffIso);

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

class SimpleCookieJar {
  private cookies = new Map<string, Map<string, string>>();

  store(urlStr: string, setCookieHeader: string | string[] | undefined): void {
    if (!setCookieHeader) return;
    const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const host = new URL(urlStr).hostname;
    const map = this.cookies.get(host) ?? new Map<string, string>();
    for (const sc of list) {
      const pair = sc.split(';')[0];
      if (!pair) continue;
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const k = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      if (!v || /expires=Thu,\s*01[- ]Jan[- ]1970/i.test(sc)) {
        map.delete(k);
      } else {
        map.set(k, v);
      }
    }
    this.cookies.set(host, map);
  }

  header(urlStr: string): string {
    const host = new URL(urlStr).hostname;
    const map = this.cookies.get(host);
    if (!map || map.size === 0) return '';
    return Array.from(map.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

function httpsRequestText(
  urlStr: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: opts.method ?? 'GET',
        family: 4,
        timeout: 15000,
        headers: opts.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer | string) =>
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
        );
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`HTTPS timeout after 15s for ${u.hostname}${u.pathname}`));
    });
    req.on('error', reject);
    if (opts.body) {
      req.write(opts.body);
    }
    req.end();
  });
}

/**
 * Completes the public anonymous UZH 3vrooms OIDC form_post session handshake via pure HTTPS
 * (zero headless browser required) and fetches 7 days of bookings across Zentrum, Irchel, and Oerlikon.
 */
export async function runUzh3vroomsScrape(
  supabase: SupabaseClient,
  daysAhead: number = 6
): Promise<UzhScrapeSummary> {
  const activeCutoffIso = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count: activeCount } = await supabase
    .from('scrape_runs')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'uzh_3vrooms')
    .eq('verdict', 'running')
    .gte('started_at', activeCutoffIso);

  if (activeCount && activeCount > 0) {
    return {
      runId: 0,
      verdict: 'ok',
      studyRoomsUpserted: 0,
      teachingRoomsUpserted: 0,
      bookingsWritten: 0,
      errors: [],
    };
  }

  const jar = new SimpleCookieJar();
  const ua = getPoliteUserAgent();
  let url = UZH_3VROOMS_PORTAL_URL;

  for (let hop = 0; hop < 10; hop++) {
    const cookieHdr = jar.header(url);
    const res = await httpsRequestText(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml',
        ...(cookieHdr ? { Cookie: cookieHdr } : {}),
      },
    });
    jar.store(url, res.headers['set-cookie']);

    const loc = typeof res.headers.location === 'string' ? res.headers.location : undefined;
    if (loc) {
      url = new URL(loc, url).toString();
      continue;
    }

    const actionMatch = /<form[^>]*action=["']([^"']+)["']/i.exec(res.body);
    if (actionMatch && actionMatch[1]) {
      const actionUrl = new URL(actionMatch[1].replace(/&amp;/g, '&'), url).toString();
      const inputs = [
        ...res.body.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi),
      ];
      const params = new URLSearchParams();
      for (const m of inputs) {
        if (m[1]) {
          params.set(m[1], (m[2] ?? '').replace(/&amp;/g, '&'));
        }
      }
      const formBody = params.toString();
      const postCookieHdr = jar.header(actionUrl);
      const postRes = await httpsRequestText(actionUrl, {
        method: 'POST',
        headers: {
          'User-Agent': ua,
          Accept: 'text/html,application/xhtml+xml',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': String(Buffer.byteLength(formBody)),
          ...(postCookieHdr ? { Cookie: postCookieHdr } : {}),
        },
        body: formBody,
      });
      jar.store(actionUrl, postRes.headers['set-cookie']);
      const nextLoc =
        typeof postRes.headers.location === 'string' ? postRes.headers.location : undefined;
      if (nextLoc) {
        url = new URL(nextLoc, actionUrl).toString();
        continue;
      }
    }
    break;
  }

  const todayYYYYMMDD = getZurichDateYYYYMMDD(Date.now());
  const endYYYYMMDD = addDaysYYYYMMDD(todayYYYYMMDD, daysAhead);
  const apiEndExclusiveYYYYMMDD = addDaysYYYYMMDD(todayYYYYMMDD, daysAhead + 1);
  const portalOrigin = new URL(UZH_3VROOMS_PORTAL_URL).origin;

  const campusInputs: UzhCampusCalendarInput[] = [];

  for (let i = 0; i < UZH_CAMPUS_FILTER_SETTINGS.length; i++) {
    const target = UZH_CAMPUS_FILTER_SETTINGS[i]!;
    if (i > 0) {
      await sleep(1500);
    }

    const apiUrl = `${portalOrigin}/default/api/v1.0/calendar?mode=Day&from=${todayYYYYMMDD}&to=${apiEndExclusiveYYYYMMDD}&filtersettingId=${target.filtersettingId}&anlassId=`;
    const cookieHdr = jar.header(apiUrl);
    const apiRes = await httpsRequestText(apiUrl, {
      headers: {
        'User-Agent': ua,
        Accept: 'application/json',
        ...(cookieHdr ? { Cookie: cookieHdr } : {}),
      },
    });

    if (apiRes.status < 200 || apiRes.status >= 300) {
      throw new Error(`UZH 3vrooms ${target.campus} HTTP ${apiRes.status}`);
    }

    const rawCalendarJson: unknown = JSON.parse(apiRes.body);
    campusInputs.push({
      campus: target.campus,
      rawCalendarJson,
    });
  }

  return persistUzhCalendarPayloads(supabase, campusInputs, todayYYYYMMDD, endYYYYMMDD);
}
