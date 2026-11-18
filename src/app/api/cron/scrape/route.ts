import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabaseClient } from '@/lib/supabase';
import { runEthScrapeBatch } from '@/lib/scrapers/nightly-eth';
import { syncUzhStaticStudyRooms } from '@/lib/scrapers/nightly-uzh';

export const preferredRegion = 'fra1';
export const maxDuration = 300; // Vercel Hobby max duration (300 seconds)

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleScrapeRequest(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleScrapeRequest(request);
}

async function handleScrapeRequest(request: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: 'Server CRON_SECRET is not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const querySecret = request.nextUrl.searchParams.get('secret');

  if (bearerSecret !== expectedSecret && querySecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchSizeParam = request.nextUrl.searchParams.get('batchSize');
  const batchSize = batchSizeParam
    ? Math.min(80, Math.max(1, Number.parseInt(batchSizeParam, 10) || 45))
    : 45;

  const syncRoomsParam = request.nextUrl.searchParams.get('syncRooms') === '1';

  try {
    const supabase = createServiceRoleSupabaseClient();
    if (syncRoomsParam) {
      await syncUzhStaticStudyRooms(supabase);
    }
    const summary = await runEthScrapeBatch(supabase, {
      batchSize,
      delayMs: 1250,
      maxRuntimeMs: 240_000,
      syncRoomList: syncRoomsParam,
      cohortHours: 30,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
