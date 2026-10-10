import { expect, test } from '@playwright/test';
import { ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { AccountingPage } from '../../pages/accounting.page.js';

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

test.describe('The chart of accounts, from the screen', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
  });

  test('views the chart of accounts, creates a new child account, and edits it', async ({ page }) => {
    const accounting = new AccountingPage(page);
    await accounting.open('cuentas');

    await expect(page.getByTestId('accounts-section')).toBeVisible();
    await expect(page.getByTestId('account-row-1')).toBeVisible();
    await expect(page.getByTestId('account-row-1.1')).toBeVisible();

    // 1. Crear una subcuenta bajo 1.1.01 (Efectivo y equivalentes)
    const suffix = stamp().slice(-4);
    const newCode = `1.1.01.9${suffix}`;
    const newName = `Fondo Fijo Especial ${suffix}`;

    await page.getByTestId('btn-new-account').click();
    await expect(page.getByTestId('account-form-modal')).toBeVisible();

    await page.getByTestId('input-account-code').fill(newCode);
    await page.getByTestId('input-account-name').fill(newName);
    await page.getByTestId('select-account-type').selectOption({ value: 'asset' });
    await page.getByTestId('input-account-accepts-entries').check();

    await page.getByTestId('btn-save-account').click();
    await expect(page.getByTestId('account-form-modal')).toBeHidden();

    // Verificar que la nueva cuenta aparece en la tabla
    await page.getByTestId('accounts-search-input').fill(newCode);
    await expect(page.getByTestId(`account-row-${newCode}`)).toBeVisible();
    await expect(page.getByTestId(`account-row-${newCode}`)).toContainText(newName);

    // 2. Editar la cuenta
    await page.getByTestId(`btn-edit-account-${newCode}`).click();
    await expect(page.getByTestId('account-form-modal')).toBeVisible();

    const updatedName = `${newName} Modificado`;
    await page.getByTestId('input-account-name').fill(updatedName);
    await page.getByTestId('btn-save-account').click();
    await expect(page.getByTestId('account-form-modal')).toBeHidden();

    await expect(page.getByTestId(`account-row-${newCode}`)).toContainText(updatedName);

    // 3. Desactivar y reactivar la cuenta
    await page.getByTestId(`btn-toggle-status-${newCode}`).click();
    await expect(page.getByTestId(`account-row-${newCode}`)).toContainText('Inactiva');

    await page.getByTestId(`btn-toggle-status-${newCode}`).click();
    await expect(page.getByTestId(`account-row-${newCode}`)).toContainText('Activa');
  });
});
