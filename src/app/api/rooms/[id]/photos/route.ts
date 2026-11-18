import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabaseClient } from '@/lib/supabase';
import { hashDeviceToken } from '@/lib/contributions';
import { sanitizeRoomPhotoBuffer } from '@/lib/photo-sanitizer';
import { CommunityPhotoItem, Room } from '@/types/domain';

export const preferredRegion = 'fra1';

const MAX_PHOTOS_PER_ROOM_PER_HOUR = 3;
const MAX_PHOTOS_PER_DAY = 8;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const roomId = decodeURIComponent(id);

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { ok: false, error: 'Invalid multipart form data' },
        { status: 400 }
      );
    }

    const rawToken = formData.get('deviceToken');
    const rawFile = formData.get('photo');

    if (
      typeof rawToken !== 'string' ||
      rawToken.trim().length < 12 ||
      rawToken.trim().length > 128
    ) {
      return NextResponse.json({ ok: false, error: 'Invalid deviceToken' }, { status: 400 });
    }
    if (!rawFile || typeof rawFile === 'string') {
      return NextResponse.json({ ok: false, error: 'Missing photo file' }, { status: 400 });
    }

    const deviceHash = hashDeviceToken(rawToken);
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
    if ((room.official_details.official_photos?.length ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, error: 'Official university photos already exist for this room.' },
        { status: 400 }
      );
    }

    const nowMs = Date.now();
    const hourSinceIso = new Date(nowMs - 60 * 60_000).toISOString();
    const daySinceIso = new Date(nowMs - 24 * 60 * 60_000).toISOString();

    const [roomHourCountRes, dayCountRes] = await Promise.all([
      supabase
        .from('photos')
        .select('id', { count: 'exact', head: true })
        .eq('device_hash', deviceHash)
        .eq('room_id', roomId)
        .gte('uploaded_at', hourSinceIso),
      supabase
        .from('photos')
        .select('id', { count: 'exact', head: true })
        .eq('device_hash', deviceHash)
        .gte('uploaded_at', daySinceIso),
    ]);

    if (
      (roomHourCountRes.count ?? 0) >= MAX_PHOTOS_PER_ROOM_PER_HOUR ||
      (dayCountRes.count ?? 0) >= MAX_PHOTOS_PER_DAY
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: 'RATE_LIMITED',
          error: 'Rate limit reached: maximum 3 photo uploads per room per hour.',
        },
        { status: 429 }
      );
    }

    const rawArrayBuffer = await rawFile.arrayBuffer();
    const cleanJpegBuffer = await sanitizeRoomPhotoBuffer(Buffer.from(rawArrayBuffer));

    const safeSlug = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `${safeSlug}/${nowMs}-${crypto.randomBytes(6).toString('hex')}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from('room-photos')
      .upload(storagePath, cleanJpegBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`);
    }

    const { data: insertedPhoto, error: dbErr } = await supabase
      .from('photos')
      .insert({
        room_id: roomId,
        storage_path: storagePath,
        device_hash: deviceHash,
      })
      .select('id, room_id, uploaded_at')
      .single();

    if (dbErr || !insertedPhoto) {
      throw new Error(`Database photo insert failed: ${dbErr?.message}`);
    }

    const publicUrl = supabase.storage.from('room-photos').getPublicUrl(storagePath).data.publicUrl;

    const photoItem: CommunityPhotoItem = {
      id: insertedPhoto.id as number,
      room_id: insertedPhoto.room_id as string,
      url: publicUrl,
      uploaded_at: insertedPhoto.uploaded_at as string,
    };

    return NextResponse.json({
      ok: true,
      photo: photoItem,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
