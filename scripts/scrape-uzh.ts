import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import { createServiceRoleSupabaseClient } from '../src/lib/supabase';
import { getPoliteUserAgent, sleep } from '../src/lib/scrapers/eth';
import { UZH_3VROOMS_PORTAL_URL, UZH_CAMPUS_FILTER_SETTINGS } from '../src/lib/scrapers/uzh';
import {
  persistUzhCalendarPayloads,
  UzhCampusCalendarInput,
} from '../src/lib/scrapers/nightly-uzh';
import { addDaysYYYYMMDD, getZurichDateYYYYMMDD } from '../src/lib/time';

function loadEnvLocal(): void {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const daysAhead = 6; // Today + 6 days (7-day window)
  const todayYYYYMMDD = getZurichDateYYYYMMDD(Date.now());
  const endYYYYMMDD = addDaysYYYYMMDD(todayYYYYMMDD, daysAhead);
  const apiEndExclusiveYYYYMMDD = addDaysYYYYMMDD(todayYYYYMMDD, daysAhead + 1);

  console.log(
    `1. Opening UZH 3vrooms anonymous calendar once (${todayYYYYMMDD} .. ${endYYYYMMDD})...`
  );

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    userAgent: getPoliteUserAgent(),
  });
  const page = await context.newPage();

  const campusInputs: UzhCampusCalendarInput[] = [];

  try {
    await page.goto(UZH_3VROOMS_PORTAL_URL, {
      waitUntil: 'networkidle',
      timeout: 35000,
    });
    await page.waitForTimeout(1500);

    for (let i = 0; i < UZH_CAMPUS_FILTER_SETTINGS.length; i++) {
      const target = UZH_CAMPUS_FILTER_SETTINGS[i]!;
      if (i > 0) {
        await sleep(1500); // Polite >= 1.5s spacing between the 3 campus requests
      }

      const apiUrl = `/default/api/v1.0/calendar?mode=Day&from=${todayYYYYMMDD}&to=${apiEndExclusiveYYYYMMDD}&filtersettingId=${target.filtersettingId}&anlassId=`;
      console.log(`   Fetching UZH ${target.campus} (1 request: ${apiUrl})...`);

      const rawCalendarJson: unknown = await page.evaluate(async (u) => {
        const resp = await fetch(u, {
          headers: { Accept: 'application/json' },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} for ${u}`);
        }
        return await resp.json();
      }, apiUrl);

      const resObj = rawCalendarJson as {
        RessourceList?: Array<{ BlockList?: Array<{ BeginnEffective?: string }> }>;
      };
      const rl = resObj.RessourceList ?? [];
      const blockDates = rl
        .flatMap((r) => r.BlockList ?? [])
        .map((b) => b.BeginnEffective?.slice(0, 10))
        .filter((d): d is string => Boolean(d))
        .sort();
      console.log(
        `   -> ${target.campus}: ${rl.length} resources, ${blockDates.length} raw blocks (${blockDates[0] ?? 'none'} .. ${blockDates[blockDates.length - 1] ?? 'none'})`
      );

      campusInputs.push({
        campus: target.campus,
        rawCalendarJson,
      });
    }
  } finally {
    await browser.close();
  }

  console.log('2. Persisting UZH rooms, study areas, and 7-day bookings to Supabase...');
  const supabase = createServiceRoleSupabaseClient();
  const summary = await persistUzhCalendarPayloads(
    supabase,
    campusInputs,
    todayYYYYMMDD,
    endYYYYMMDD
  );

  console.log('3. UZH sync completed:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('UZH scrape failed:', err);
  process.exit(1);
});
