import { expect, test } from '@playwright/test';
import { SystemStatusPage } from '../../pages/system-status.page.js';

test.describe('System status page', () => {
  test('reports the system as healthy when everything works', async ({
    page,
  }) => {
    const statusPage = new SystemStatusPage(page);
    await statusPage.open();

    await expect(statusPage.panel).toBeVisible();
    expect(await statusPage.isHealthy()).toBe(true);
  });

  test('shows the API responding and the database up', async ({ page }) => {
    const statusPage = new SystemStatusPage(page);
    await statusPage.open();

    await expect(statusPage.apiStatus).toContainText('HTTP 200');
    await expect(statusPage.databaseStatus).toContainText('up');
  });

  test('publishes a measurable database latency', async ({ page }) => {
    const statusPage = new SystemStatusPage(page);
    await statusPage.open();

    const latency = await statusPage.latencyInMilliseconds();
    expect(latency).not.toBeNull();
    expect(latency).toBeGreaterThanOrEqual(0);
  });

  test('shows no error message while healthy', async ({ page }) => {
    const statusPage = new SystemStatusPage(page);
    await statusPage.open();

    await expect(statusPage.errorMessage).toHaveCount(0);
  });
});
