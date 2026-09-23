import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { PurchasingPage } from '../../pages/purchasing.page.js';
import { ReceivablesPage } from '../../pages/receivables.page.js';
import { SalesPage } from '../../pages/sales.page.js';

test.describe('Credit notes and returns UI', () => {
  test('administrator navigates sales returns, credit notes, and purchase returns demo data', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    const sales = new SalesPage(page);
    const receivables = new ReceivablesPage(page);
    const purchasing = new PurchasingPage(page);

    await test.step('Verifica devoluciones de venta sembradas', async () => {
      await sales.open('devoluciones');
      await expect(page.getByTestId('sales-return-row-DVV000001')).toBeVisible();
      await expect(page.getByTestId('sales-return-status-DVV000001')).toHaveText('Confirmada');

      await expect(page.getByTestId('sales-return-row-DVV000002')).toBeVisible();
      await expect(page.getByTestId('sales-return-status-DVV000002')).toHaveText('Confirmada');
    });

    await test.step('Verifica notas de crédito y su crédito disponible', async () => {
      await receivables.open('notas-de-credito');
      await expect(page.getByTestId('credit-note-row-NCC000001')).toBeVisible();
      await expect(page.getByTestId('credit-note-status-NCC000001')).toHaveText('Confirmada');
      await expect(page.getByTestId('credit-note-available-NCC000001')).toHaveText('USD 0,00');

      await expect(page.getByTestId('credit-note-row-NCC000002')).toBeVisible();
      await expect(page.getByTestId('credit-note-status-NCC000002')).toHaveText('Confirmada');

      await expect(page.getByTestId('credit-note-row-NCC000003')).toBeVisible();
      await expect(page.getByTestId('credit-note-status-NCC000003')).toHaveText('Confirmada');
      // La nota 3 tenia 11.60 total, pago 4.64 en su emision y 5.00 en cobro posterior -> saldo 1.96
      await expect(page.getByTestId('credit-note-available-NCC000003')).toHaveText('USD 1,96');
    });

    await test.step('Verifica devoluciones de compra sembradas', async () => {
      await purchasing.open('devoluciones');
      await expect(page.getByTestId('purchase-return-row-DVC000001')).toBeVisible();
      await expect(page.getByTestId('purchase-return-status-DVC000001')).toHaveText('Confirmada');
    });
  });

  test('read-only accountant sees records without action buttons', async ({ page }) => {
    await new LoginPage(page).signIn(ACCOUNTANT);
    const sales = new SalesPage(page);
    const receivables = new ReceivablesPage(page);
    const purchasing = new PurchasingPage(page);

    await sales.open('devoluciones');
    await expect(page.getByTestId('sales-return-row-DVV000001')).toBeVisible();
    await expect(page.getByTestId('btn-new-sales-return')).toHaveCount(0);

    await receivables.open('notas-de-credito');
    await expect(page.getByTestId('credit-note-row-NCC000001')).toBeVisible();
    await expect(page.getByTestId('btn-new-credit-note')).toHaveCount(0);

    await purchasing.open('devoluciones');
    await expect(page.getByTestId('purchase-return-row-DVC000001')).toBeVisible();
    await expect(page.getByTestId('btn-new-purchase-return')).toHaveCount(0);
  });
});
