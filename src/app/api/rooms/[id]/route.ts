import { NextRequest, NextResponse } from 'next/server';
import { createPublicSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase';
import {
  computeLockTrend,
  emptyCommunitySummary,
  hashDeviceToken,
  resolveDetailConsensus,
} from '@/lib/contributions';
import { fetchEthRoomOfficialDetails } from '@/lib/scrapers/eth';
import { getZurichDayBounds } from '@/lib/time';
import {
  Booking,
  Building,
  CommunityPhotoItem,
  DetailName,
  DetailReportRow,
  LockReportRow,
  Room,
  RoomCommunitySummary,
} from '@/types/domain';

export const preferredRegion = 'fra1';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);
    const supabase = createPublicSupabaseClient();
    const nowIso = request.nextUrl.searchParams.get('now') ?? new Date().toISOString();
    const dayBounds = getZurichDayBounds(nowIso);

    const { data: roomData, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', decodedId)
      .single();

    if (roomErr || !roomData) {
      return NextResponse.json(
        { ok: false, error: `Room not found: ${decodedId}` },
        { status: 404 }
      );
    }

    let room = roomData as Room;

    // Lazy 1-request official detail & photo enrichment for ETH Rauminfo rooms
    if (
      room.institution === 'ETH' &&
      room.official_url?.includes('rauminfo/raumdetails.html') &&
      (!room.official_details.official_photos_checked ||
        room.official_details.is_departmental_room === undefined)
    ) {
      try {
        const fetchedOfficial = await fetchEthRoomOfficialDetails(room.display_name);
        const mergedDetails = {
          ...room.official_details,
          ...fetchedOfficial,
          official_photos:
            fetchedOfficial.official_photos ?? room.official_details.official_photos ?? [],
          official_photos_checked: true,
        };
        const serviceSupabase = createServiceRoleSupabaseClient();
        await serviceSupabase
          .from('rooms')
          .update({
            official_details: mergedDetails,
            updated_at: new Date().toISOString(),
          })
          .eq('id', room.id);

        room = {
          ...room,
          official_details: mergedDetails,
        };
      } catch {
        // Non-fatal: if ETH Rauminfo is temporarily slow or unreachable, serve cached room data immediately
      }
    }

    const [buildingRes, bookingsRes] = await Promise.all([
      supabase.from('buildings').select('*').eq('id', room.building_id).maybeSingle(),
      supabase
        .from('bookings')
        .select('*')
        .eq('room_id', room.id)
        .lt('start_time', dayBounds.dayEndIso)
        .gt('end_time', dayBounds.dayStartIso)
        .order('start_time', { ascending: true }),
    ]);

    let community: RoomCommunitySummary = emptyCommunitySummary();
    let communityPhotos: CommunityPhotoItem[] = [];
    const myVotes: Partial<Record<DetailName, string>> = {};

    try {
      const serviceSupabase = createServiceRoleSupabaseClient();
      const [lockRes, detailRes, photoRes] = await Promise.all([
        serviceSupabase
          .from('lock_reports')
          .select('id, room_id, reported_at, is_locked, device_hash, hidden')
          .eq('room_id', room.id)
          .eq('hidden', false)
          .order('reported_at', { ascending: false }),
        serviceSupabase
          .from('detail_reports')
          .select('id, room_id, detail_name, detail_value, reported_at, device_hash, hidden')
          .eq('room_id', room.id)
          .eq('hidden', false)
          .order('reported_at', { ascending: false }),
        serviceSupabase
          .from('photos')
          .select('id, room_id, storage_path, uploaded_at')
          .eq('room_id', room.id)
          .eq('hidden', false)
          .order('uploaded_at', { ascending: false }),
      ]);

      const lockRows = (lockRes.data ?? []) as LockReportRow[];
      const detailRows = (detailRes.data ?? []) as DetailReportRow[];
      const photoRows = (photoRes.data ?? []) as Array<{
        id: number;
        room_id: string;
        storage_path: string;
        uploaded_at: string;
      }>;

      communityPhotos = photoRows.map((p) => ({
        id: p.id,
        room_id: p.room_id,
        url: serviceSupabase.storage.from('room-photos').getPublicUrl(p.storage_path).data
          .publicUrl,
        uploaded_at: p.uploaded_at,
      }));

      community = {
        lockTrend: computeLockTrend(lockRows),
        details: resolveDetailConsensus(detailRows),
        photoCount: communityPhotos.length,
      };

      const rawDeviceToken =
        request.headers.get('x-device-token') ?? request.nextUrl.searchParams.get('deviceToken');
      if (rawDeviceToken && rawDeviceToken.trim().length >= 12) {
        const myHash = hashDeviceToken(rawDeviceToken);
        for (const r of detailRows) {
          if (r.device_hash === myHash && !myVotes[r.detail_name]) {
            myVotes[r.detail_name] = r.detail_value;
          }
        }
      }
    } catch {
      // Ignore if service role is unavailable
    }

    return NextResponse.json({
      ok: true,
      zurichDateYYYYMMDD: dayBounds.dateYYYYMMDD,
      room,
      building: (buildingRes.data as Building | null) ?? null,
      bookings: (bookingsRes.data ?? []) as Booking[],
      community,
      communityPhotos,
      myVotes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
