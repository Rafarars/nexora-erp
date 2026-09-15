import { expect, test } from '@playwright/test';
import { ACCOUNTANT, INITECH_ADMIN, LoginPage } from '../../pages/login.page.js';
import { AppShell } from '../../pages/app-shell.page.js';

// Las tasas de la pantalla van en Initech, en 2002 y en la serie interna: las pruebas de la API usan
// 2001 y la serie legal. Cargar la misma tasa otra vez la corrige, asi que repetir da lo mismo.
test.describe('Exchange rates, from the administration', () => {
  test('records a rate with a decimal comma and corrects it from its row', async ({ page }) => {
    await new LoginPage(page).signIn(INITECH_ADMIN);
    await new AppShell(page).goToAdministration('tasas');

    await page.getByTestId('new-rate').click();
    await page.getByTestId('rate-currency').selectOption('EUR');
    await page.getByTestId('rate-date').fill('2002-03-04');
    await page.getByTestId('rate-type').selectOption('manual');
    await page.getByTestId('rate-value').fill('0,95');
    await page.getByTestId('rate-source').fill('Tesorería');
    await page.getByTestId('rate-submit').click();

    const key = 'EUR-manual-2002-03-04';
    await expect(page.getByTestId(`rate-value-${key}`)).toHaveText('0,95');
    await expect(page.getByTestId(`rate-status-${key}`)).toHaveText('Activa');

    await page.getByTestId(`rate-options-${key}`).click();
    await page.getByTestId(`rate-edit-${key}`).click();
    await page.getByTestId('rate-value').fill('0,97');
    await page.getByTestId('rate-submit').click();

    await expect(page.getByTestId(`rate-value-${key}`)).toHaveText('0,97');
  });

  test('explains a rate that is not valid', async ({ page }) => {
    await new LoginPage(page).signIn(INITECH_ADMIN);
    await new AppShell(page).goToAdministration('tasas');
    await page.getByTestId('new-rate').click();

    await page.getByTestId('rate-value').fill('0');
    await page.getByTestId('rate-submit').click();
    await expect(page.getByTestId('rate-error')).toHaveText('La tasa tiene que ser mayor que cero, con hasta 8 decimales y menos de 10.000.000.');

    await page.getByTestId('rate-value').fill('treinta');
    await page.getByTestId('rate-submit').click();
    await expect(page.getByTestId('rate-error')).toHaveText('Escribe la tasa como un número, por ejemplo 36,50.');
  });

  test('a read-only role sees the rates in force and filters the list, with no way to change them', async ({ page }) => {
    await new LoginPage(page).signIn(ACCOUNTANT);
    await new AppShell(page).goToAdministration('tasas');

    await expect(page.getByTestId('rate-current-USD')).toBeVisible();
    await expect(page.getByTestId('rate-value-EUR-legal-2026-09-11')).toHaveText('175,05');
    await expect(page.getByTestId('new-rate')).toHaveCount(0);
    await expect(page.getByTestId('rate-options-EUR-legal-2026-09-11')).toHaveCount(0);

    await page.getByTestId('rates-moneda').selectOption('EUR');
    await page.getByTestId('rates-filter-submit').click();

    await expect(page.getByTestId('rate-value-USD-legal-2026-09-11')).toHaveCount(0);
    await expect(page.getByTestId('rate-value-EUR-legal-2026-09-11')).toBeVisible();
  });
});
