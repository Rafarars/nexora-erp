import type { Locator, Page } from '@playwright/test';

// Unico archivo que conoce selectores.
export class SystemStatusPage {
  readonly panel: Locator;
  readonly apiStatus: Locator;
  readonly databaseStatus: Locator;
  readonly databaseLatency: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.panel = page.getByTestId('system-status');
    this.apiStatus = page.getByTestId('api-status');
    this.databaseStatus = page.getByTestId('database-status');
    this.databaseLatency = page.getByTestId('database-latency');
    this.errorMessage = page.getByTestId('api-error');
  }

  async open(): Promise<void> {
    await this.page.goto('/');
  }

  async isHealthy(): Promise<boolean> {
    return (await this.panel.getAttribute('data-healthy')) === 'true';
  }

  async latencyInMilliseconds(): Promise<number | null> {
    const text = (await this.databaseLatency.textContent())?.trim() ?? '';
    const match = text.match(/(\d+)\s*ms/);
    return match ? Number(match[1]) : null;
  }
}
