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

  test('creates an originless sales return with manual cost from the UI (H8 §4.1 rule 3)', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    const sales = new SalesPage(page);

    await sales.open('devoluciones');
    await page.getByTestId('btn-new-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();

    // Seleccionar opcion sin despacho de origen
    await page.getByTestId('sales-return-dispatch-select').selectOption({ value: 'none' });

    // Completar datos: cliente, bodega, articulo, unidad, cantidad y costo unitario manual
    await page.getByTestId('sales-return-customer-select').selectOption({ index: 1 });
    await page.getByTestId('sales-return-warehouse-select').selectOption({ index: 1 });
    await page.getByTestId('sales-return-item-0').selectOption({ index: 1 });
    await page.getByTestId('sales-return-unit-0').selectOption({ index: 1 });
    await page.getByTestId('sales-return-qty-0').fill('2');
    await page.getByTestId('sales-return-unit-cost-0').fill('3.75');

    await page.getByTestId('btn-save-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeHidden();

    // La tabla debe mostrar la nueva devolucion con "Sin origen"
    const row = page.locator('tr').filter({ hasText: 'Sin origen' }).first();
    await expect(row).toBeVisible();
  });

  test('displays translated business error in Spanish when attempting to return more than dispatched', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    const sales = new SalesPage(page);

    await sales.open('devoluciones');
    await page.getByTestId('btn-new-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();

    // Seleccionar despacho sembrado DES000001
    const optionValue = await page.locator('#dispatchSelect option', { hasText: 'DES000001' }).getAttribute('value');
    await page.getByTestId('sales-return-dispatch-select').selectOption(optionValue!);

    // El input tiene max=2 (cantidad despachada). Forzamos 999 para comprobar la regla de negocio del backend
    const qtyInput = page.locator('[data-testid^="sales-return-qty-"]').first();
    await qtyInput.evaluate((el: HTMLInputElement) => el.removeAttribute('max'));
    await qtyInput.fill('999');

    await page.getByTestId('btn-save-sales-return').click();

    // El formulario muestra el error de negocio traducido
    await expect(page.getByTestId('sales-return-form-error')).toHaveText(
      'La cantidad a devolver supera lo que queda disponible de ese despacho.',
    );
  });
});
