import { expect, test } from '@playwright/test';
import { ACCOUNTANT, GLOBEX_ADMIN, INITECH_ADMIN, LoginPage } from '../../pages/login.page.js';
import { AppShell } from '../../pages/app-shell.page.js';

// Las pruebas de la API cambian los datos y parametros de Initech: desde la pantalla solo se toca el
// nombre comercial de Globex, que no sale en ningun reporte, y se devuelve.
test.describe('The company, from the administration', () => {
  test('edits the data the company puts on its documents', async ({ page }) => {
    await new LoginPage(page).signIn(GLOBEX_ADMIN);
    await new AppShell(page).goToAdministration('empresa');

    const tradeName = page.getByTestId('company-trade-name');
    const original = await tradeName.inputValue();

    try {
      await tradeName.fill('Globex Express');
      await page.getByTestId('company-profile-submit').click();
      await expect(page.getByTestId('company-profile-saved')).toBeVisible();

      await page.reload();
      await expect(page.getByTestId('company-trade-name')).toHaveValue('Globex Express');
      await expect(page.getByTestId('company-fiscal-id')).toHaveValue('J-40000002-0');
    } finally {
      await page.getByTestId('company-trade-name').fill(original);
      await page.getByTestId('company-profile-submit').click();
      await expect(page.getByTestId('company-profile-saved')).toBeVisible();
    }
  });

  test('shows today in the time zone of the company and explains an invalid value', async ({ page }) => {
    await new LoginPage(page).signIn(INITECH_ADMIN);
    await new AppShell(page).goToAdministration('empresa');

    await expect(page.getByTestId('company-today')).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
    // Sin fijar la zona: una prueba de la API puede estar cambiandola en este momento.
    await expect(page.getByTestId('company-time-zone')).toHaveValue(/^[A-Za-z]+(\/[A-Za-z0-9_+-]+)*$/);

    await page.getByTestId('company-amount-decimals').fill('9');
    await page.getByTestId('company-settings-submit').click();

    await expect(page.getByTestId('company-settings-error')).toHaveText('Los importes admiten de 0 a 4 decimales y los precios de 0 a 6.');
  });

  test('a read-only role sees the data and the settings but gets no way to change them', async ({ page }) => {
    await new LoginPage(page).signIn(ACCOUNTANT);
    await new AppShell(page).goToAdministration('empresa');

    await expect(page.getByTestId('company-profile-readonly')).toContainText('Acme Industrial, C.A.');
    await expect(page.getByTestId('company-settings-readonly')).toContainText('America/Caracas');
    await expect(page.getByTestId('company-profile-submit')).toHaveCount(0);
    await expect(page.getByTestId('company-settings-submit')).toHaveCount(0);
  });
});
