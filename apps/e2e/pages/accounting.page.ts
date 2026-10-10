import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

type Section = 'cuentas' | 'asientos';

export class AccountingPage {
  constructor(private readonly page: Page) {}

  async open(section: Section = 'cuentas'): Promise<void> {
    if (!this.page.url().includes('/contabilidad/')) {
      await this.page.getByTestId('nav-contabilidad').click();
      await expect(this.page).toHaveURL(/\/contabilidad\/[a-z-]+/);
    }

    await expect(async () => {
      await this.page.getByTestId(`accounting-${section}`).click();
      await expect(this.page).toHaveURL(new RegExp(`/contabilidad/${section}`), { timeout: 2_000 });
    }).toPass();

    await expect(this.page.getByTestId('accounting-nav')).toBeVisible();
  }
}
