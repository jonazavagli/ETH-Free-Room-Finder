import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleSupabaseClient } from '@/lib/supabase';
import {
  DETAIL_ALLOWED_VALUES,
  getOfficialDetailValue,
  hashDeviceToken,
  resolveDetailConsensus,
} from '@/lib/contributions';
import { DetailName, DetailReportRow, Room } from '@/types/domain';

const DetailReportBodySchema = z.object({
  detailName: z.enum(['outlets', 'board', 'desk_type', 'lighting', 'noise']),
  detailValue: z.string().trim().min(1).max(40),
  deviceToken: z.string().trim().min(12).max(128),
});

const MAX_SAME_DETAIL_EDITS_PER_10_MIN = 4;
const MAX_TOTAL_DETAIL_EDITS_PER_HOUR = 20;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const roomId = decodeURIComponent(id);

    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = DetailReportBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid detail report payload' },
        { status: 400 }
      );
    }

    const { detailName, detailValue, deviceToken } = parsed.data;
    const allowed = DETAIL_ALLOWED_VALUES[detailName];
    if (!allowed.includes(detailValue)) {
      return NextResponse.json(
        { ok: false, error: `Invalid value "${detailValue}" for detail "${detailName}"` },
        { status: 400 }
      );
    }

    const deviceHash = hashDeviceToken(deviceToken);
    const supabase = createServiceRoleSupabaseClient();

    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if (!roomData) {
      return NextResponse.json({ ok: false, error: 'Room not found' }, { status: 404 });
    }

    const room = roomData as Room;
    if (getOfficialDetailValue(room, detailName) !== null) {
      return NextResponse.json(
        { ok: false, error: 'This detail already has an official university value.' },
        { status: 400 }
      );
    }

    const nowMs = Date.now();
    const tenMinSinceIso = new Date(nowMs - 10 * 60_000).toISOString();
    const hourSinceIso = new Date(nowMs - 60 * 60_000).toISOString();

    const [sameDetailCountRes, hourlyCountRes] = await Promise.all([
      supabase
        .from('detail_reports')
        .select('id', { count: 'exact', head: true })
        .eq('device_hash', deviceHash)
        .eq('room_id', roomId)
        .eq('detail_name', detailName)
        .gte('reported_at', tenMinSinceIso),
      supabase
        .from('detail_reports')
        .select('id', { count: 'exact', head: true })
        .eq('device_hash', deviceHash)
        .gte('reported_at', hourSinceIso),
    ]);

    if (
      (sameDetailCountRes.count ?? 0) >= MAX_SAME_DETAIL_EDITS_PER_10_MIN ||
      (hourlyCountRes.count ?? 0) >= MAX_TOTAL_DETAIL_EDITS_PER_HOUR
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: 'RATE_LIMITED',
          error:
            'Rate limit reached: too many detail edits in a short time. Please wait a few minutes.',
        },
        { status: 429 }
      );
    }

    const { error: insertErr } = await supabase.from('detail_reports').insert({
      room_id: roomId,
      detail_name: detailName,
      detail_value: detailValue,
      device_hash: deviceHash,
    });

    if (insertErr) {
      throw new Error(`Failed to store detail report: ${insertErr.message}`);
    }

    const { data: detailRowsRaw } = await supabase
      .from('detail_reports')
      .select('id, room_id, detail_name, detail_value, reported_at, device_hash, hidden')
      .eq('room_id', roomId)
      .eq('hidden', false)
      .order('reported_at', { ascending: false });

    const detailRows = (detailRowsRaw ?? []) as DetailReportRow[];
    const details = resolveDetailConsensus(detailRows);

    const myVotes: Partial<Record<DetailName, string>> = {};
    for (const r of detailRows) {
      if (r.device_hash === deviceHash && !myVotes[r.detail_name]) {
        myVotes[r.detail_name] = r.detail_value;
      }
    }

    return NextResponse.json({
      ok: true,
      details,
      myVotes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
