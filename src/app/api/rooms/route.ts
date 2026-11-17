import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { createPublicSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase';
import { computeLockTrend, resolveDetailConsensus } from '@/lib/contributions';
import { getZurichDayBounds } from '@/lib/time';
import {
  Booking,
  Building,
  DetailReportRow,
  LockReportRow,
  Room,
  RoomCommunitySummary,
} from '@/types/domain';

const PAGE_SIZE = 1000;

async function fetchAllRooms(supabase: SupabaseClient): Promise<Room[]> {
  const all: Room[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('display_name', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Rooms query failed: ${error.message}`);
    }
    const batch = (data ?? []) as Room[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }
  return all;
}

async function fetchAllDayBookings(
  supabase: SupabaseClient,
  dayStartIso: string,
  dayEndIso: string
): Promise<Booking[]> {
  const all: Booking[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .lt('start_time', dayEndIso)
      .gt('end_time', dayStartIso)
      .order('start_time', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Bookings query failed: ${error.message}`);
    }
    const batch = (data ?? []) as Booking[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }
  return all;
}

async function fetchCommunitySummariesByRoomId(): Promise<Record<string, RoomCommunitySummary>> {
  let serviceSupabase: SupabaseClient;
  try {
    serviceSupabase = createServiceRoleSupabaseClient();
  } catch {
    return {};
  }

  const [lockRes, detailRes, photoRes] = await Promise.all([
    serviceSupabase
      .from('lock_reports')
      .select('id, room_id, reported_at, is_locked, device_hash, hidden')
      .eq('hidden', false)
      .order('reported_at', { ascending: false })
      .range(0, 4999),
    serviceSupabase
      .from('detail_reports')
      .select('id, room_id, detail_name, detail_value, reported_at, device_hash, hidden')
      .eq('hidden', false)
      .order('reported_at', { ascending: false })
      .range(0, 4999),
    serviceSupabase.from('photos').select('id, room_id').eq('hidden', false).range(0, 4999),
  ]);

  const locksByRoom = new Map<string, LockReportRow[]>();
  for (const row of (lockRes.data ?? []) as LockReportRow[]) {
    const list = locksByRoom.get(row.room_id);
    if (list) list.push(row);
    else locksByRoom.set(row.room_id, [row]);
  }

  const detailsByRoom = new Map<string, DetailReportRow[]>();
  for (const row of (detailRes.data ?? []) as DetailReportRow[]) {
    const list = detailsByRoom.get(row.room_id);
    if (list) list.push(row);
    else detailsByRoom.set(row.room_id, [row]);
  }

  const photoCountByRoom = new Map<string, number>();
  for (const row of (photoRes.data ?? []) as Array<{ id: number; room_id: string }>) {
    photoCountByRoom.set(row.room_id, (photoCountByRoom.get(row.room_id) ?? 0) + 1);
  }

  const roomIds = new Set<string>([
    ...locksByRoom.keys(),
    ...detailsByRoom.keys(),
    ...photoCountByRoom.keys(),
  ]);

  const summaries: Record<string, RoomCommunitySummary> = {};
  for (const roomId of roomIds) {
    summaries[roomId] = {
      lockTrend: computeLockTrend(locksByRoom.get(roomId) ?? []),
      details: resolveDetailConsensus(detailsByRoom.get(roomId) ?? []),
      photoCount: photoCountByRoom.get(roomId) ?? 0,
    };
  }

  return summaries;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createPublicSupabaseClient();
    const simulateStale = request.nextUrl.searchParams.get('simulateStale') === '1';
    const customNowIso = request.nextUrl.searchParams.get('now') ?? new Date().toISOString();

    const dayBounds = getZurichDayBounds(customNowIso);

    const [buildingsRes, fetchedRooms, bookings, communitySummariesByRoomId] = await Promise.all([
      supabase.from('buildings').select('*').order('code', { ascending: true }).range(0, 999),
      fetchAllRooms(supabase),
      fetchAllDayBookings(supabase, dayBounds.dayStartIso, dayBounds.dayEndIso),
      fetchCommunitySummariesByRoomId(),
    ]);

    if (buildingsRes.error) {
      throw new Error(`Buildings query failed: ${buildingsRes.error.message}`);
    }

    const buildings = (buildingsRes.data ?? []) as Building[];
    let rooms = fetchedRooms;

    if (simulateStale) {
      const staleIso = new Date(Date.parse(customNowIso) - 48 * 3600_000).toISOString();
      rooms = rooms.map((r) =>
        r.schedule_status === 'ok' ? { ...r, last_scraped_at: staleIso } : r
      );
    }

    return NextResponse.json({
      ok: true,
      zurichDateYYYYMMDD: dayBounds.dateYYYYMMDD,
      evaluatedAtIso: customNowIso,
      buildings,
      rooms,
      bookings,
      communitySummariesByRoomId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
