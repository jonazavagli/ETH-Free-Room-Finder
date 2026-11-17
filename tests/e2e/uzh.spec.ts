import { expect, test } from '@playwright/test';

test.describe('UZH Rooms, Study Areas & Map E2E (Phone Size 390x844)', () => {
  test('filters by UZH, searches UZH rooms and study areas, checks map pins, and opens UZH room page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // 1. Select UZH in University filter
    await page.getByTestId('institution-filter-UZH').click();

    // Wait for UZH buildings (e.g. KOL, HAH) to load and confirm ETH-only campus Hönggerberg is hidden
    const kolButton = page.getByRole('button', { name: 'KOL', exact: true });
    await expect(kolButton).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Hönggerberg', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Irchel', exact: true })).toBeVisible();

    // 2. Pick KOL and HAH and tap Search
    await kolButton.click();
    await page.getByRole('button', { name: 'HAH', exact: true }).click();
    await page.getByRole('button', { name: /Search free rooms/i }).click();

    await expect(page).toHaveURL(/inst=UZH/);
    const cards = page.getByTestId('room-card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    // 3. Switch to Map view and verify UZH building pins render
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.getByTestId('map-view')).toBeVisible();
    await expect(page.getByTestId('map-building-rooms')).toBeVisible();

    // 4. Switch back to List view and open the first UZH room detail page
    await page.getByRole('button', { name: 'List', exact: true }).click();
    const firstRoomTitle = await cards.first().locator('h3').innerText();
    await cards.first().click();

    await expect(page.getByRole('heading', { name: firstRoomTitle })).toBeVisible();
    await expect(page.getByRole('link', { name: /UZH campus map/i })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Official UZH (occupancy calendar|study rooms page)/i })
    ).toBeVisible();
  });
});
