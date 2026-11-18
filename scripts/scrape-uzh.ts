import fs from 'fs';
import path from 'path';
import { createServiceRoleSupabaseClient } from '../src/lib/supabase';
import { runUzh3vroomsScrape } from '../src/lib/scrapers/nightly-uzh';
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

  console.log(
    `1. Fetching UZH 3vrooms anonymous calendar (${todayYYYYMMDD} .. ${endYYYYMMDD}) across Zentrum, Irchel, and Oerlikon...`
  );

  const supabase = createServiceRoleSupabaseClient();
  const summary = await runUzh3vroomsScrape(supabase, daysAhead);

  console.log('2. UZH sync completed:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('UZH scrape failed:', err);
  process.exit(1);
});
