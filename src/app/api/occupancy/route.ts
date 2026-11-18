import { NextResponse } from 'next/server';
import { fetchEthStudySpacesAvailability } from '@/lib/scrapers/eth-studyspaces';
import { LiveOccupancyItem } from '@/types/domain';

export const preferredRegion = 'fra1';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedOccupancy: {
  fetchedAtMs: number;
  fetchedAtIso: string;
  itemsByKey: Record<string, LiveOccupancyItem>;
} | null = null;

export async function GET(): Promise<NextResponse> {
  try {
    const nowMs = Date.now();
    if (cachedOccupancy && nowMs - cachedOccupancy.fetchedAtMs < CACHE_TTL_MS) {
      return NextResponse.json(
        {
          ok: true,
          cached: true,
          fetchedAtIso: cachedOccupancy.fetchedAtIso,
          occupancyByKey: cachedOccupancy.itemsByKey,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
          },
        }
      );
    }

    const { occupancyItems } = await fetchEthStudySpacesAvailability();
    const itemsByKey: Record<string, LiveOccupancyItem> = {};
    for (const item of occupancyItems) {
      itemsByKey[item.key] = item;
    }

    const fetchedAtIso = new Date(nowMs).toISOString();
    cachedOccupancy = {
      fetchedAtMs: nowMs,
      fetchedAtIso,
      itemsByKey,
    };

    return NextResponse.json(
      {
        ok: true,
        cached: false,
        fetchedAtIso,
        occupancyByKey: itemsByKey,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
