import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabaseClient } from '@/lib/supabase';
import { runEthScrapeBatch } from '@/lib/scrapers/nightly-eth';
import {
  runUzh3vroomsScrape,
  syncUzhStaticStudyRooms,
  UzhScrapeSummary,
} from '@/lib/scrapers/nightly-uzh';

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

  const mode = request.nextUrl.searchParams.get('mode'); // optional: 'uzh-only' | 'eth-only'
  const batchSizeParam = request.nextUrl.searchParams.get('batchSize');
  const batchSize = batchSizeParam
    ? Math.min(80, Math.max(1, Number.parseInt(batchSizeParam, 10) || 65))
    : 65;

  const syncRoomsParam = request.nextUrl.searchParams.get('syncRooms') === '1';
  const forceUzh = request.nextUrl.searchParams.get('includeUzh') === '1' || mode === 'uzh-only';

  try {
    const supabase = createServiceRoleSupabaseClient();
    if (syncRoomsParam) {
      await syncUzhStaticStudyRooms(supabase);
    }

    // Automatically refresh UZH 3vrooms once per night when oldest UZH room is > 20h old (or forced)
    let uzhSummary: UzhScrapeSummary | { skipped: string } | null = null;
    if (mode !== 'eth-only') {
      let uzhDue = forceUzh;
      if (!uzhDue) {
        const uzhCutoffIso = new Date(Date.now() - 20 * 3600_000).toISOString();
        const { count: staleUzhCount } = await supabase
          .from('rooms')
          .select('id', { count: 'exact', head: true })
          .eq('institution', 'UZH')
          .eq('schedule_status', 'ok')
          .or(`last_scraped_at.is.null,last_scraped_at.lte.${uzhCutoffIso}`);
        uzhDue = (staleUzhCount ?? 0) > 0;
      }

      if (uzhDue) {
        try {
          uzhSummary = await runUzh3vroomsScrape(supabase, 6);
        } catch (uzhErr) {
          const msg = uzhErr instanceof Error ? uzhErr.message : String(uzhErr);
          uzhSummary = { skipped: `error: ${msg}` };
        }
      }
    }

    if (mode === 'uzh-only') {
      return NextResponse.json({ ok: true, uzhSummary });
    }

    const summary = await runEthScrapeBatch(supabase, {
      batchSize,
      delayMs: 1250,
      maxRuntimeMs: 220_000,
      syncRoomList: syncRoomsParam,
      cohortHours: 20,
    });

    return NextResponse.json({
      ok: true,
      summary,
      ...(uzhSummary ? { uzhSummary } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
