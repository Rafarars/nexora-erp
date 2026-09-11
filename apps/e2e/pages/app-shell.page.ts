import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// El armazon que envuelve todas las pantallas: quien soy, en que empresa estoy y a
// donde puedo ir.
export class AppShell {
  readonly currentUser: Locator;
  readonly activeTenant: Locator;
  readonly tenantSwitcher: Locator;
  readonly logout: Locator;

  constructor(private readonly page: Page) {
    this.currentUser = page.getByTestId('current-user');
    this.activeTenant = page.getByTestId('active-tenant');
    this.tenantSwitcher = page.getByTestId('tenant-switcher');
    this.logout = page.getByTestId('logout');
  }

  async goTo(section: 'panel' | 'usuarios' | 'roles' | 'estado'): Promise<void> {
    await this.page.getByTestId(`nav-${section}`).click();
  }

  async switchTo(tenantName: string): Promise<void> {
    await this.tenantSwitcher.selectOption({ label: tenantName });
    await this.page.getByTestId('tenant-switch-submit').click();
    await expect(this.activeTenant).toHaveText(tenantName);
  }
}
