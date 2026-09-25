import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { PurchasingPage } from '../../pages/purchasing.page.js';
import { ReceivablesPage } from '../../pages/receivables.page.js';
import { SalesPage } from '../../pages/sales.page.js';
import { tokenFor } from '../../support/inventory-fixtures.js';

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

  test('displays customer total available credit and credit note selector in collections form', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    const receivables = new ReceivablesPage(page);

    await receivables.open('cobros');
    await page.getByTestId('new-payment').click();
    await expect(page.getByTestId('payment-panel')).toBeVisible();

    // Al elegir cliente con notas confirmadas (Farmacia San Rafael tiene NCC000003 con crédito disponible)
    await page.getByTestId('payment-customer').selectOption({ label: 'Farmacia San Rafael' });
    await expect(page.getByTestId('payment-customer-available-credit')).toContainText('USD 1,96');

    // Con forma credit_note, aparece el selector con la nota y su remanente disponible
    await page.getByTestId('payment-method').selectOption('credit_note');
    await expect(page.getByTestId('payment-credit-source')).toBeVisible();
    await expect(page.getByTestId('payment-credit-source')).toContainText('NCC000003');
    await expect(page.getByTestId('payment-credit-source')).toContainText('1,96 disponible');
  });

  test('credit note date input has default value and max attribute set to company today', async ({ page, request }) => {
    const API = process.env.API_URL ?? 'http://localhost:3001';
    const token = await tokenFor(request, ACME_ADMIN.email, API);
    const settings = await (
      await request.get(`${API}/api/v1/company/settings`, { headers: { Authorization: `Bearer ${token}` } })
    ).json();

    await new LoginPage(page).signIn(ACME_ADMIN);
    const receivables = new ReceivablesPage(page);

    await receivables.open('notas-de-credito');
    await page.getByTestId('new-credit-note').click();
    await expect(page.getByTestId('credit-note-panel')).toBeVisible();

    const dateInput = page.getByTestId('credit-note-date');
    await expect(dateInput).toHaveValue(settings.today);
    await expect(dateInput).toHaveAttribute('max', settings.today);
  });

  test('internal notes label contains optional badge exactly once', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    const receivables = new ReceivablesPage(page);

    await receivables.open('notas-de-credito');
    await page.getByTestId('new-credit-note').click();
    await expect(page.getByTestId('credit-note-panel')).toBeVisible();

    const notesLabel = page.locator('label[for="notes"]');
    await expect(notesLabel).toHaveText('Notas internas (opcional)');
  });

  test('issue payment for credit note shows origin note code and cannot be cancelled', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    const receivables = new ReceivablesPage(page);

    await receivables.open('cobros');
    await expect(page.getByTestId('payment-row-COB000004')).toBeVisible();
    await expect(page.getByTestId('payment-issue-note-COB000004')).toHaveText('Emisión de NCC000003');

    // El cobro de emisión no ofrece la acción de anular (no tiene menú de opciones abierto ni botón)
    await expect(page.getByTestId('payment-options-COB000004')).toHaveCount(0);
  });

  // test.slow(): Medido: 10.6s sola en local (39.7s total proceso), 13.4s dentro de suite (1.3m total)
  test('edits draft sales returns with dispatch and originless without creating duplicates or changing codes', async ({ page }) => {
    test.slow();
    await new LoginPage(page).signIn(ACME_ADMIN);
    const sales = new SalesPage(page);

    await sales.open('devoluciones');

    // 1. Crear borrador con despacho DES000001 y motivo único
    const beforeCodes1 = await page.locator('[data-testid="sales-return-code"]').allInnerTexts();
    const uniqueReason1 = `Motivo inicial despacho ${Date.now()}`;
    await page.getByTestId('btn-new-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();

    const dispatchOption = await page.locator('#dispatchSelect option', { hasText: 'DES000001' }).getAttribute('value');
    await page.getByTestId('sales-return-dispatch-select').selectOption(dispatchOption!);

    const qtyInput1 = page.locator('[data-testid^="sales-return-qty-"]').first();
    await qtyInput1.fill('1');
    await page.getByTestId('sales-return-reason-input').fill(uniqueReason1);
    await page.getByTestId('btn-save-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeHidden();

    // Esperar a que la tabla revalide e incorpore la nueva fila
    await expect(async () => {
      const codes = await page.locator('[data-testid="sales-return-code"]').allInnerTexts();
      expect(codes.some((c) => !beforeCodes1.includes(c))).toBe(true);
    }).toPass();
    const afterCodes1 = await page.locator('[data-testid="sales-return-code"]').allInnerTexts();
    const firstDraftCode = afterCodes1.find((c) => !beforeCodes1.includes(c))!;
    expect(firstDraftCode).toBeDefined();
    await expect(page.getByTestId(`sales-return-row-${firstDraftCode}`)).toBeVisible();

    // 2. Editar el borrador con despacho: modificar motivo y cantidad
    const editedReason1 = `Motivo editado despacho ${Date.now()}`;
    await page.getByTestId(`sales-return-options-${firstDraftCode}`).click();
    await page.getByTestId(`sales-return-edit-${firstDraftCode}`).click();

    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();
    await expect(page.getByTestId('sales-return-reason-input')).toHaveValue(uniqueReason1);

    await page.getByTestId('sales-return-reason-input').fill(editedReason1);
    await qtyInput1.fill('2');
    await page.getByTestId('btn-save-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeHidden();

    // Reabrir el borrador editado y verificar que guardó efectivamente los cambios
    await page.getByTestId(`sales-return-options-${firstDraftCode}`).click();
    await page.getByTestId(`sales-return-edit-${firstDraftCode}`).click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();
    await expect(page.getByTestId('sales-return-reason-input')).toHaveValue(editedReason1);
    await expect(qtyInput1).toHaveValue('2');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeHidden();

    // Comprobar que el código no cambió y no apareció otro
    await expect(page.getByTestId(`sales-return-row-${firstDraftCode}`)).toBeVisible();
    await expect(page.locator(`[data-testid="sales-return-row-${firstDraftCode}"]`)).toHaveCount(1);

    // 3. Crear borrador sin origen con motivo único
    const beforeCodes2 = await page.locator('[data-testid="sales-return-code"]').allInnerTexts();
    const uniqueReason2 = `Motivo inicial sin origen ${Date.now()}`;
    await page.getByTestId('btn-new-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();

    await page.getByTestId('sales-return-dispatch-select').selectOption('none');
    await page.getByTestId('sales-return-customer-select').selectOption({ label: 'Farmacia San Rafael' });
    await page.getByTestId('sales-return-warehouse-select').selectOption({ label: 'Principal' });
    await page.getByTestId('sales-return-condition-select').selectOption('resalable');
    await page.getByTestId('sales-return-reason-input').fill(uniqueReason2);

    await page.getByTestId('sales-return-item-0').selectOption({ index: 1 });
    await page.getByTestId('sales-return-unit-0').selectOption({ index: 1 });
    await page.getByTestId('sales-return-qty-0').fill('2');
    await page.getByTestId('sales-return-unit-cost-0').fill('15');

    await page.getByTestId('btn-save-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeHidden();

    // Esperar a que la tabla revalide e incorpore la nueva fila sin origen
    await expect(async () => {
      const codes = await page.locator('[data-testid="sales-return-code"]').allInnerTexts();
      expect(codes.some((c) => !beforeCodes2.includes(c))).toBe(true);
    }).toPass();
    const afterCodes2 = await page.locator('[data-testid="sales-return-code"]').allInnerTexts();
    const originlessCode = afterCodes2.find((c) => !beforeCodes2.includes(c))!;
    expect(originlessCode).toBeDefined();
    await expect(page.getByTestId(`sales-return-row-${originlessCode}`)).toBeVisible();

    // 4. Editar el borrador sin origen: modificar motivo y cantidad
    const editedReason2 = `Motivo editado sin origen ${Date.now()}`;
    await page.getByTestId(`sales-return-options-${originlessCode}`).click();
    await page.getByTestId(`sales-return-edit-${originlessCode}`).click();

    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();
    await expect(page.getByTestId('sales-return-reason-input')).toHaveValue(uniqueReason2);

    await page.getByTestId('sales-return-reason-input').fill(editedReason2);
    await page.getByTestId('sales-return-qty-0').fill('3');
    await page.getByTestId('btn-save-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeHidden();

    // Reabrir el borrador sin origen editado y verificar que guardó efectivamente los cambios
    await page.getByTestId(`sales-return-options-${originlessCode}`).click();
    await page.getByTestId(`sales-return-edit-${originlessCode}`).click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();
    await expect(page.getByTestId('sales-return-reason-input')).toHaveValue(editedReason2);
    await expect(page.getByTestId('sales-return-qty-0')).toHaveValue('3');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeHidden();

    // Comprobar que el código no cambió y no apareció otro
    await expect(page.getByTestId(`sales-return-row-${originlessCode}`)).toBeVisible();
    await expect(page.locator(`[data-testid="sales-return-row-${originlessCode}"]`)).toHaveCount(1);
  });

  // test.slow(): Medido: 6.7s sola en local (36.5s total proceso), 9.4s dentro de suite (1.3m total)
  test('edits draft purchase return without creating duplicates or changing code', async ({ page }) => {
    test.slow();
    await new LoginPage(page).signIn(ACME_ADMIN);
    const purchasing = new PurchasingPage(page);

    await purchasing.open('devoluciones');

    // 1. Crear borrador de devolución de compra con motivo único
    const beforeCodes = await page.locator('[data-testid="purchase-return-code"]').allInnerTexts();
    const uniqueReason = `Motivo compra inicial ${Date.now()}`;
    await page.getByTestId('btn-new-purchase-return').click();
    await expect(page.getByTestId('purchase-return-create-panel')).toBeVisible();

    const receiptOption = await page.locator('#receiptSelect option').nth(1).getAttribute('value');
    await page.getByTestId('purchase-return-receipt-select').selectOption(receiptOption!);

    const qtyInput = page.locator('[data-testid^="purchase-return-qty-"]').first();
    await qtyInput.fill('1');
    await page.getByTestId('purchase-return-reason-input').fill(uniqueReason);
    await page.getByTestId('btn-save-purchase-return').click();
    await expect(page.getByTestId('purchase-return-create-panel')).toBeHidden();

    // Esperar a que la tabla revalide e incorpore la nueva fila
    await expect(async () => {
      const codes = await page.locator('[data-testid="purchase-return-code"]').allInnerTexts();
      expect(codes.some((c) => !beforeCodes.includes(c))).toBe(true);
    }).toPass();
    const afterCodes = await page.locator('[data-testid="purchase-return-code"]').allInnerTexts();
    const returnCode = afterCodes.find((c) => !beforeCodes.includes(c))!;
    expect(returnCode).toBeDefined();
    await expect(page.getByTestId(`purchase-return-row-${returnCode}`)).toBeVisible();

    // 2. Editar el borrador: cambiar motivo y cantidad
    const editedReason = `Motivo compra editado ${Date.now()}`;
    await page.getByTestId(`purchase-return-options-${returnCode}`).click();
    await page.getByTestId(`purchase-return-edit-${returnCode}`).click();

    await expect(page.getByTestId('purchase-return-create-panel')).toBeVisible();
    await expect(page.getByTestId('purchase-return-reason-input')).toHaveValue(uniqueReason);

    await page.getByTestId('purchase-return-reason-input').fill(editedReason);
    await qtyInput.fill('2');
    await page.getByTestId('btn-save-purchase-return').click();
    await expect(page.getByTestId('purchase-return-create-panel')).toBeHidden();

    // Reabrir el borrador editado y verificar que guardó efectivamente los cambios
    await page.getByTestId(`purchase-return-options-${returnCode}`).click();
    await page.getByTestId(`purchase-return-edit-${returnCode}`).click();
    await expect(page.getByTestId('purchase-return-create-panel')).toBeVisible();
    await expect(page.getByTestId('purchase-return-reason-input')).toHaveValue(editedReason);
    await expect(qtyInput).toHaveValue('2');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('purchase-return-create-panel')).toBeHidden();

    // Comprobar que el código no cambió y no apareció otro
    await expect(page.getByTestId(`purchase-return-row-${returnCode}`)).toBeVisible();
    await expect(page.locator(`[data-testid="purchase-return-row-${returnCode}"]`)).toHaveCount(1);
  });
});
