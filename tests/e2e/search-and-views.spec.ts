import { expect, test } from '@playwright/test';

test.describe('Search, Views & Room Page E2E (Phone Size 390x844)', () => {
  test('opens filter form, runs search, switches list/timeline, simulates stale warning, and opens room page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // 1. Verify nothing is searched before tapping Search
    await expect(page.getByRole('heading', { name: /Find a free room today/i })).toBeVisible();
    await expect(page.getByTestId('room-card')).toHaveCount(0);

    // 2. Filter to ETH + building HG and tap Search
    await page.getByTestId('institution-filter-ETH').click();
    const hgButton = page.getByRole('button', { name: 'HG', exact: true });
    await expect(hgButton).toBeVisible({ timeout: 10000 });
    await hgButton.click();

    await page.getByRole('button', { name: /Search free rooms/i }).click();

    // 3. Verify results appear and URL state updated
    await expect(page).toHaveURL(/searched=1/);
    const cards = page.getByTestId('room-card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    // 4. Switch to Timeline view, Map view, and back to List view
    await page.getByRole('button', { name: 'Timeline', exact: true }).click();
    await expect(page.getByText(/Booked \(striped\)/i)).toBeVisible();

    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.getByTestId('map-view')).toBeVisible();
    await expect(page.getByTestId('map-building-rooms')).toBeVisible();

    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByTestId('live-occupancy-badge').first()).toBeVisible();

    // 5. Simulate stale data (>36h) and verify warning banner appears
    await page.getByLabel(/Simulate stale data/i).check();
    await page.getByRole('button', { name: /Search free rooms/i }).click();
    await expect(page.getByTestId('stale-data-warning')).toBeVisible();

    // Uncheck stale simulation and wait for fresh data to settle
    await page.getByLabel(/Simulate stale data/i).uncheck();
    await expect(page.getByTestId('stale-data-warning')).toHaveCount(0, { timeout: 10000 });

    // 6. Tap a room card and verify room detail page opens
    const firstRoomTitle = await cards.first().locator('h3').innerText();
    await cards.first().click();

    await expect(page).toHaveURL(/\/rooms\//);
    await expect(page.getByRole('heading', { level: 1, name: firstRoomTitle })).toBeVisible();
    await expect(page.getByRole('link', { name: /Official ETH Rauminfo page/i })).toBeVisible();
  });
});
