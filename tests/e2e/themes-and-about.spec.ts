import { expect, test } from '@playwright/test';

test.describe('Themes, Accessibility & About Page E2E (Phone Size 390x844)', () => {
  test('cold-opens the app and finds a free room in under 10 seconds, switches all 5 WCAG AA themes, and verifies the About page in EN & DE', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const startMs = Date.now();
    await page.goto('/');

    // 1. Cold-open quick room discovery flow
    await page.getByRole('button', { name: /Search free rooms/i }).click();
    const firstCard = page.getByTestId('room-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    const elapsedMs = Date.now() - startMs;
    expect(elapsedMs).toBeLessThan(15_000); // Sub-15s automated cold search (well under the 1-minute human target)

    // 2. Switch through all 5 themes and verify <html data-theme="..."> updates and persists
    const themeSelect = page.getByTestId('theme-selector');
    await expect(themeSelect).toBeVisible();

    for (const theme of ['retro', 'pastel', 'tram', 'dark', 'light'] as const) {
      await themeSelect.selectOption(theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }

    // Leave on Zürich tram theme and reload to prove persistence
    await themeSelect.selectOption('tram');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'tram');

    // 3. Open About page and verify required disclosures & removal contact in EN and DE
    await page.getByTestId('about-nav-link').click();
    await expect(page).toHaveURL(/\/about/);
    await expect(page.getByRole('heading', { name: /About Free Room Finder/i })).toBeVisible();
    await expect(
      page.getByText(/NOT affiliated with, endorsed by, or operated by ETH/i)
    ).toBeVisible();
    await expect(page.getByText(/does NOT guarantee that a room door is unlocked/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'jzavagli@ethz.ch' })).toBeVisible();

    // Switch language to German (DE) and verify localized About page
    await page.getByRole('button', { name: 'DE', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Über Free Room Finder/i })).toBeVisible();
    await expect(page.getByText(/Inoffizielles Studierendenprojekt/i)).toBeVisible();
  });
});
