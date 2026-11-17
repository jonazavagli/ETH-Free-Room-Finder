import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import { createServiceRoleSupabaseClient } from '@/lib/supabase';
import { hashDeviceToken } from '@/lib/contributions';
import { inspectImageBufferMetadata } from '@/lib/photo-sanitizer';
import { createTestJpegWithGpsExif } from '../helpers/exif-gps-jpeg';

function loadEnvLocal(): void {
  const envPath = path.resolve(__dirname, '../../.env.local');
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

loadEnvLocal();

const TEST_ROOM_ID = 'UZH:FRE-D-14';
const runTag = `${Date.now()}`;
const DEVICE_1 = `e2e-contrib-dev1-${runTag}`;
const DEVICE_2 = `e2e-contrib-dev2-${runTag}`;
const DEVICE_3_BROWSER = `e2e-contrib-dev3-${runTag}`;

test.describe('Community Contributions & EXIF Stripping E2E (Phone Size 390x844)', () => {
  const uploadedStoragePaths: string[] = [];

  test.afterAll(async () => {
    // Clean up synthetic E2E test rows and storage objects so live database stays clean
    const sb = createServiceRoleSupabaseClient();
    const testHashes = [DEVICE_1, DEVICE_2, DEVICE_3_BROWSER].map((t) => hashDeviceToken(t));

    const { data: photoRows } = await sb
      .from('photos')
      .select('storage_path')
      .in('device_hash', testHashes);

    const allPaths = Array.from(
      new Set([
        ...uploadedStoragePaths,
        ...((photoRows ?? []) as Array<{ storage_path: string }>).map((r) => r.storage_path),
      ])
    );

    if (allPaths.length > 0) {
      await sb.storage.from('room-photos').remove(allPaths);
    }

    await sb.from('photos').delete().in('device_hash', testHashes);
    await sb.from('detail_reports').delete().in('device_hash', testHashes);
    await sb.from('lock_reports').delete().in('device_hash', testHashes);
  });

  test('shows official photos & official details without upload/edit buttons on ETH:HG E 3, and proves GPS stripping, 3-device consensus, and rate limits on UZH:FRE-D-14', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Seed browser's localStorage device token to DEVICE_3_BROWSER
    await page.addInitScript((token) => {
      window.localStorage.setItem('frf_device_token_v1', token);
    }, DEVICE_3_BROWSER);

    // Part A: ETH room with official photos & official details (HG E 3)
    await page.goto('/rooms/ETH%3AHG%20E%203');
    await expect(page.getByRole('heading', { name: 'HG E 3' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('official-photos-badge')).toBeVisible();
    await expect(page.getByTestId('official-room-photo').first()).toBeVisible();
    await expect(page.getByTestId('upload-photo-button')).toHaveCount(0);

    // Outlets & board are given online -> marked Official with no voting buttons
    await expect(page.getByTestId('detail-official-badge-outlets')).toBeVisible();
    await expect(page.getByTestId('vote-outlets-many')).toHaveCount(0);
    // Noise is not given online -> voting buttons ARE shown
    await expect(page.getByTestId('vote-noise-quiet')).toBeVisible();

    // Part B: UZH room without official photos or official details (UZH:FRE-D-14)
    // 1. Pre-cast 2 device votes ('many' and 'many') on `outlets` via API
    for (const devToken of [DEVICE_1, DEVICE_2]) {
      const voteRes = await request.post(
        `/api/rooms/${encodeURIComponent(TEST_ROOM_ID)}/detail-report`,
        {
          data: {
            detailName: 'outlets',
            detailValue: 'many',
            deviceToken: devToken,
          },
        }
      );
      expect(voteRes.ok()).toBe(true);
    }

    await page.goto(`/rooms/${encodeURIComponent(TEST_ROOM_ID)}`);
    await expect(page.getByRole('heading', { name: 'FRE-D-14' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('community-photos-badge')).toBeVisible();
    await expect(page.getByTestId('upload-photo-button')).toBeVisible();

    // 2. Device 3 votes 'few' on outlets in the phone UI -> 3 devices total (2 'many', 1 'few') -> resolves to 'Many outlets'
    await page.getByTestId('vote-outlets-few').click();
    await expect(page.getByTestId('detail-community-badge-outlets')).toContainText(
      /Community \(3 votes\)/i
    );
    await expect(page.getByTestId('detail-consensus-value-outlets')).toHaveText('Many outlets');

    // 3. Upload a real JPEG carrying EXIF GPS metadata via phone UI and verify the stored file in Supabase Storage has ZERO metadata
    const gpsJpegBuffer = await createTestJpegWithGpsExif();
    const beforeMeta = await inspectImageBufferMetadata(gpsJpegBuffer);
    expect(beforeMeta.hasExif).toBe(true);
    expect(beforeMeta.containsExifHeaderBytes).toBe(true);

    // Also test direct multipart upload of raw GPS JPEG to API (bypassing browser canvas) to prove server-side stripping too!
    const directUploadRes = await request.post(
      `/api/rooms/${encodeURIComponent(TEST_ROOM_ID)}/photos`,
      {
        multipart: {
          deviceToken: DEVICE_1,
          photo: {
            name: 'gps-camera-raw.jpg',
            mimeType: 'image/jpeg',
            buffer: gpsJpegBuffer,
          },
        },
      }
    );
    expect(directUploadRes.status()).toBe(200);
    const directUploadJson = (await directUploadRes.json()) as {
      ok: boolean;
      photo: { url: string };
    };
    expect(directUploadJson.ok).toBe(true);

    // Download stored image back from Supabase Storage and verify ZERO EXIF / GPS bytes remain
    const downloadedDirect = await request.get(directUploadJson.photo.url);
    expect(downloadedDirect.status()).toBe(200);
    const downloadedDirectBuffer = Buffer.from(await downloadedDirect.body());
    const afterDirectMeta = await inspectImageBufferMetadata(downloadedDirectBuffer);
    expect(afterDirectMeta.hasExif).toBe(false);
    expect(afterDirectMeta.containsExifHeaderBytes).toBe(false);
    expect(downloadedDirectBuffer.includes(Buffer.from('SecretGPSMarker', 'ascii'))).toBe(false);

    // Also upload via the phone UI file input and confirm the rendered <img> comes back clean
    await page.locator('#room-photo-upload').setInputFiles({
      name: 'phone-gps-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: gpsJpegBuffer,
    });
    const uploadedImg = page.getByTestId('community-room-photo').first();
    await expect(uploadedImg).toBeVisible({ timeout: 15000 });
    const uiPhotoUrl = await uploadedImg.getAttribute('src');
    expect(uiPhotoUrl).toBeTruthy();

    const downloadedUi = await request.get(uiPhotoUrl!);
    const downloadedUiBuffer = Buffer.from(await downloadedUi.body());
    const afterUiMeta = await inspectImageBufferMetadata(downloadedUiBuffer);
    expect(afterUiMeta.hasExif).toBe(false);
    expect(afterUiMeta.containsExifHeaderBytes).toBe(false);

    // 4. Submit a lock report ("It was open") and immediately submit a second one to trigger the 429 rate limit
    await page.getByTestId('report-open-btn').click();
    await expect(page.getByTestId('lock-feedback')).toContainText(/Recorded: door was open/i);

    await page.getByTestId('report-locked-btn').click();
    await expect(page.getByTestId('lock-feedback')).toContainText(/Rate limit reached/i);
  });
});
