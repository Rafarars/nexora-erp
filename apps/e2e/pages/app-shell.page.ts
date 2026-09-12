import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// El armazon que envuelve todas las pantallas: quien soy, en que empresa estoy y a
// donde puedo ir.
export class AppShell {
  readonly currentUser: Locator;
  readonly activeTenant: Locator;
  readonly tenantSwitcher: Locator;
  readonly accountButton: Locator;

  constructor(private readonly page: Page) {
    this.currentUser = page.getByTestId('current-user');
    this.activeTenant = page.getByTestId('active-tenant');
    this.tenantSwitcher = page.getByTestId('tenant-switcher');
    this.accountButton = page.getByTestId('account-button');
  }

  // Los modulos del negocio viven en la barra lateral; la cuenta y la administracion,
  // en el menu del nombre.
  async goTo(module: 'panel'): Promise<void> {
    await this.page.getByTestId(`nav-${module}`).click();
  }

  async goToAdministration(section: 'usuarios' | 'roles'): Promise<void> {
    await this.accountButton.click();
    await this.page.getByTestId('account-administration').click();
    await this.page.getByTestId(`admin-${section}`).click();
  }

  async goToProfile(): Promise<void> {
    await this.accountButton.click();
    await this.page.getByTestId('account-profile').click();
  }

  async logout(): Promise<void> {
    await this.accountButton.click();
    await this.page.getByTestId('logout').click();
  }

  async switchTo(tenantName: string): Promise<void> {
    await this.tenantSwitcher.selectOption({ label: tenantName });
    await this.page.getByTestId('tenant-switch-submit').click();
    await expect(this.activeTenant).toHaveText(tenantName);
  }
}
