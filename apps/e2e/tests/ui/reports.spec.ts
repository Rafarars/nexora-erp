import { expect, test } from '@playwright/test';
import { ACCOUNTANT, GLOBEX_ADMIN, LoginPage } from '../../pages/login.page.js';
import { ReportsPage } from '../../pages/reports.page.js';
import { excelRows, pdfText } from '../../support/report-files.js';

test('the panel shows the dashboard and the aging report downloads as Excel with the same figures', async ({ page }) => {
  const reports = new ReportsPage(page);

  await test.step('Dado que el administrador de Globex inició sesión', async () => {
    await new LoginPage(page).signIn(GLOBEX_ADMIN);
  });

  await test.step('Entonces el tablero dice que le deben 61,20 y el inventario vale 212,50', async () => {
    await expect(page.getByTestId('dashboard-receivable')).toHaveText('61,20');
    await expect(page.getByTestId('dashboard-inventory')).toHaveText('212,50');
    await expect(page.getByTestId('dashboard-debtors-1')).toContainText('Talleres Omega');
  });

  await test.step('Y cada indicador dice en qué moneda está', async () => {
    await expect(page.getByTestId('dashboard-receivable').locator('xpath=../dt')).toContainText('USD');
  });

  await test.step('Cuando abre la antigüedad de saldos y la descarga en Excel', async () => {
    await reports.open('antiguedad');
    await expect(page.getByTestId('report-aging-CLI000001')).toContainText('61,20');
    await expect(page.getByTestId('report-aging')).toBeVisible();
    await expect(page.getByText('Importes en USD')).toBeVisible();
  });

  await test.step('Entonces el archivo trae a Talleres Omega con 61,20', async () => {
    const { download, content } = await reports.download('download-antiguedad-xlsx');

    expect(download.suggestedFilename()).toMatch(/^antiguedad-de-saldos-.*\.xlsx$/);
    expect((await excelRows(content)).find((row) => row[1] === 'Talleres Omega')?.at(-1)).toBe(61.2);
  });
});

test('downloads the statement of a customer as PDF from the screen', async ({ page }) => {
  const reports = new ReportsPage(page);

  await new LoginPage(page).signIn(GLOBEX_ADMIN);
  await reports.open('estado-de-cuenta');
  await page.getByTestId('report-statement-customer').selectOption({ label: 'Talleres Omega' });
  await page.getByTestId('report-statement-submit').click();
  await expect(page.getByTestId('report-statement-summary')).toContainText('61,20');

  const { content } = await reports.download('download-estado-de-cuenta-pdf');

  expect(await pdfText(content)).toContain('Estado de cuenta — Talleres Omega');
});

test('a read-only role gets the dashboard and the receivables reports but not the valuation at cost', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);

  await expect(page.getByTestId('dashboard')).toBeVisible();
  await new ReportsPage(page).open('antiguedad');
  await expect(page.getByTestId('reports-valuacion-inventario')).toHaveCount(0);
});
