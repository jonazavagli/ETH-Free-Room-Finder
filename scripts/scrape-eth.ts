import fs from 'fs';
import path from 'path';
import { createServiceRoleSupabaseClient } from '../src/lib/supabase';
import { runEthScrapeBatch, syncEthCatalogToDatabase } from '../src/lib/scrapers/nightly-eth';

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
  const args = process.argv.slice(2);
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const buildingsArg = args.find((a) => a.startsWith('--buildings='));
  const syncOnly = args.includes('--sync-only');

  const batchSize = batchArg ? Number.parseInt(batchArg.split('=')[1] ?? '25', 10) : 25;
  const buildingFilter = buildingsArg
    ? (buildingsArg.split('=')[1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const supabase = createServiceRoleSupabaseClient();

  console.log('1. Syncing ETH room catalog (/v2/rooms) -> Supabase...');
  const catalogRes = await syncEthCatalogToDatabase(supabase);
  console.log(
    `   Catalog synced: ${catalogRes.buildingsUpserted} buildings, ${catalogRes.roomsUpserted} teaching rooms.`
  );

  if (syncOnly) {
    return;
  }

  console.log(
    `2. Running polite ETH booking batch (batchSize=${batchSize}, delay=1200ms, buildings=${
      buildingFilter ? buildingFilter.join(',') : 'ALL'
    })...`
  );
  const summary = await runEthScrapeBatch(supabase, {
    batchSize,
    delayMs: 1200,
    buildingFilter,
    cohortHours: 30,
  });

  console.log('3. Scrape batch completed:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('ETH scrape failed:', err);
  process.exit(1);
});
