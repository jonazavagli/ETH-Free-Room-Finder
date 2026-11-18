import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleSupabaseClient } from '@/lib/supabase';
import { computeLockTrend, hashDeviceToken } from '@/lib/contributions';
import { LockReportRow } from '@/types/domain';

export const preferredRegion = 'fra1';

const LockReportBodySchema = z.object({
  isLocked: z.boolean(),
  deviceToken: z.string().trim().min(12).max(128),
});

const COOLDOWN_PER_ROOM_MINUTES = 15;
const MAX_LOCK_REPORTS_PER_HOUR = 15;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const roomId = decodeURIComponent(id);

    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = LockReportBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid lock report payload' },
        { status: 400 }
      );
    }

    const { isLocked, deviceToken } = parsed.data;
    const deviceHash = hashDeviceToken(deviceToken);
    const supabase = createServiceRoleSupabaseClient();

    // Verify room exists
    const { data: roomExists } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .maybeSingle();

    if (!roomExists) {
      return NextResponse.json({ ok: false, error: 'Room not found' }, { status: 404 });
    }

    const nowMs = Date.now();
    const cooldownSinceIso = new Date(nowMs - COOLDOWN_PER_ROOM_MINUTES * 60_000).toISOString();
    const hourSinceIso = new Date(nowMs - 60 * 60_000).toISOString();

    const [roomCooldownRes, hourlyCountRes] = await Promise.all([
      supabase
        .from('lock_reports')
        .select('id', { count: 'exact', head: true })
        .eq('device_hash', deviceHash)
        .eq('room_id', roomId)
        .gte('reported_at', cooldownSinceIso),
      supabase
        .from('lock_reports')
        .select('id', { count: 'exact', head: true })
        .eq('device_hash', deviceHash)
        .gte('reported_at', hourSinceIso),
    ]);

    if (
      (roomCooldownRes.count ?? 0) >= 1 ||
      (hourlyCountRes.count ?? 0) >= MAX_LOCK_REPORTS_PER_HOUR
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: 'RATE_LIMITED',
          error:
            'Rate limit reached: please wait 15 minutes before submitting another lock report for this room.',
        },
        { status: 429 }
      );
    }

    const { error: insertErr } = await supabase.from('lock_reports').insert({
      room_id: roomId,
      is_locked: isLocked,
      device_hash: deviceHash,
    });

    if (insertErr) {
      throw new Error(`Failed to store lock report: ${insertErr.message}`);
    }

    const { data: lockRows } = await supabase
      .from('lock_reports')
      .select('id, room_id, reported_at, is_locked, device_hash, hidden')
      .eq('room_id', roomId)
      .eq('hidden', false)
      .order('reported_at', { ascending: false });

    const lockTrend = computeLockTrend((lockRows ?? []) as LockReportRow[]);

    return NextResponse.json({
      ok: true,
      lockTrend,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
