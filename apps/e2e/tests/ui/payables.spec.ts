import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { InventoryPage } from '../../pages/inventory.page.js';
import { PayablesPage } from '../../pages/payables.page.js';
import { tokenFor } from '../../support/inventory-fixtures.js';
import { aConfirmedMerchandiseInvoice, aConfirmedPurchaseInvoice, aFreshSupplier } from '../../support/purchasing-fixtures.js';

const API = process.env.API_URL ?? 'http://localhost:3001';

test('pays part of a purchase invoice from the screen and cancelling the payment gives the balance back', async ({ page, request }) => {
  test.slow();
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const supplier = await aFreshSupplier(request, token, API);
  const invoice = await aConfirmedPurchaseInvoice(request, token, supplier.id, 100, undefined, API);
  const payables = new PayablesPage(page);

  await test.step('Dado que la administradora de Acme inició sesión y se le debe una factura de 100 al proveedor', async () => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    await payables.open('facturas', invoice.code);
    await expect(page.getByTestId(`payable-balance-${invoice.code}`)).toHaveText('100,00');
    await expect(page.getByTestId(`payable-status-${invoice.code}`)).toHaveText('Pendiente');
  });

  await test.step('Cuando registra un pago de 40 y lo confirma', async () => {
    await payables.open('pagos');
    await payables.startPayment(supplier.name, [{ invoice: invoice.code, amount: '40' }], 'TRF-UI');
    await expect(page.getByTestId('payment-panel')).toBeHidden();
    const row = payables.paymentOf(supplier.name);
    await expect(row.getByTestId(/payment-status-/)).toHaveText('Borrador');
    await payables.act(row, 'Confirmar');
    await expect(row.getByTestId(/payment-status-/)).toHaveText('Confirmado');
  });

  await test.step('Entonces la factura debe 60, y el estado de cuenta y la antigüedad lo cuadran', async () => {
    await payables.open('facturas', invoice.code);
    await expect(page.getByTestId(`payable-balance-${invoice.code}`)).toHaveText('60,00');
    await expect(page.getByTestId(`payable-status-${invoice.code}`)).toHaveText('Abonada');

    await payables.open('antiguedad', supplier.name);
    await expect(page.getByTestId(`aging-balance-${supplier.code}`)).toHaveText('60,00');

    await payables.open('estado-de-cuenta');
    await payables.showStatementOf(supplier.name);
    await expect(page.getByTestId('statement-balance-2')).toHaveText('60,00');
    await expect(page.getByTestId('statement-summary')).toContainText('60,00');
  });

  await test.step('Cuando anula el pago', async () => {
    await payables.open('pagos');
    await payables.act(payables.paymentOf(supplier.name), 'Anular');
    await expect(payables.paymentOf(supplier.name).getByTestId(/payment-status-/)).toHaveText('Anulado');
  });

  await test.step('Entonces la factura vuelve a deber 100', async () => {
    await payables.open('facturas', invoice.code);
    await expect(page.getByTestId(`payable-balance-${invoice.code}`)).toHaveText('100,00');
    await expect(page.getByTestId(`payable-status-${invoice.code}`)).toHaveText('Pendiente');
  });
});

test('pays a dollar purchase invoice in bolivars from the screen and shows the exchange difference', async ({ page, request }) => {
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const supplier = await aFreshSupplier(request, token, API);
  const invoice = await aConfirmedPurchaseInvoice(request, token, supplier.id, 100, '2026-09-08', API);
  const payables = new PayablesPage(page);

  await new LoginPage(page).signIn(ACME_ADMIN);
  await payables.open('pagos');
  await page.getByTestId('new-payment').click();
  await page.getByTestId('payment-supplier').selectOption({ label: supplier.name });
  await page.getByTestId('payment-currency').selectOption('VES');
  await page.getByTestId('payment-reference').fill('TRF-BS');
  await page.getByTestId(`payment-allocation-${invoice.code}`).fill('40');
  await page.getByTestId('payment-submit').click();
  await expect(page.getByTestId('payment-panel')).toBeHidden();

  const row = payables.paymentOf(supplier.name);
  await payables.act(row, 'Confirmar');
  await expect(row.getByTestId(/payment-status-/)).toHaveText('Confirmado');
  await expect(row.getByTestId(/payment-amount-/)).toContainText('VES');

  await payables.open('facturas', invoice.code);
  await expect(page.getByTestId(`payable-balance-${invoice.code}`)).toHaveText('60,00');
});

test('spends available credit from a credit note in a payment from the screen', async ({ page, request }) => {
  test.slow();
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const supplier = await aFreshSupplier(request, token, API);
  const invoice1 = await aConfirmedPurchaseInvoice(request, token, supplier.id, 100, '2026-09-08', API);
  const invoice2 = await aConfirmedPurchaseInvoice(request, token, supplier.id, 50, '2026-09-08', API);
  const payables = new PayablesPage(page);

  // Pagar 80 a invoice1 para dejarle saldo vivo de 20
  const payRes = await request.post(`${API}/api/v1/payables/payments`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      supplierId: supplier.id,
      date: '2026-09-08',
      method: 'transfer',
      reference: 'TRF-PREV',
      currency: 'USD',
      allocations: [{ invoiceId: invoice1.id, amount: 80 }],
    },
  });
  expect(payRes.status(), await payRes.text()).toBe(201);
  const prePay = await payRes.json();
  const confirmPrePay = await request.put(`${API}/api/v1/payables/payments/${prePay.id}/confirm`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(confirmPrePay.status(), await confirmPrePay.text()).toBe(200);

  // Crear una nota de crédito por API por 30 (menor a total 100, mayor a saldo vivo 20)
  const noteRes = await request.post(`${API}/api/v1/payables/credit-notes`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      supplierId: supplier.id,
      invoiceId: invoice1.id,
      reason: 'subsequent_discount',
      date: '2026-09-08',
      lines: [
        {
          invoiceLineId: invoice1.lines[0]?.id,
          concept: 'Descuento comercial e2e',
          quantity: 1,
          unitPrice: 30,
          taxRate: 0,
        },
      ],
    },
  });
  expect(noteRes.status(), await noteRes.text()).toBe(201);
  const note = await noteRes.json();

  // Confirmar la nota de crédito: amortiza 20 USD en invoice1 y deja 10 USD de crédito disponible
  const confirmNoteRes = await request.put(`${API}/api/v1/payables/credit-notes/${note.id}/confirm`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(confirmNoteRes.status(), await confirmNoteRes.text()).toBe(200);

  await new LoginPage(page).signIn(ACME_ADMIN);
  await payables.open('pagos');

  // Comprobar que en el formulario de pago aparece el crédito disponible y el selector de nota
  await page.getByTestId('new-payment').click();
  await page.getByTestId('payment-supplier').selectOption({ label: supplier.name });
  await expect(page.getByTestId('payment-supplier-available-credit')).toContainText('10,00');

  // Elegir forma de pago "Nota de crédito"
  await page.getByTestId('payment-method').selectOption('credit_note');
  const creditSelect = page.getByTestId('payment-credit-source');
  await expect(creditSelect).toBeVisible();
  await creditSelect.selectOption(note.id);

  // Abonar 10 USD a invoice2 usando el crédito disponible
  await page.getByTestId(`payment-allocation-${invoice2.code}`).fill('10');
  await page.getByTestId('payment-submit').click();
  await expect(page.getByTestId('payment-panel')).toBeHidden();

  // Confirmar el pago
  const draftRow = payables.paymentOf(supplier.name).filter({ hasText: 'Borrador' });
  await expect(draftRow).toBeVisible();
  await payables.act(draftRow, 'Confirmar');
  const confirmedRow = payables.paymentOf(supplier.name).filter({ hasText: 'Confirmado' }).first();
  await expect(confirmedRow.getByTestId(/payment-status-/)).toHaveText('Confirmado');
  await expect(confirmedRow.getByTestId(/payment-credit-source-/)).toHaveText(`Nota de crédito ${note.code}`);

  // Verificar que la factura 2 ahora debe 40 USD
  await payables.open('facturas', invoice2.code);
  await expect(page.getByTestId(`payable-balance-${invoice2.code}`)).toHaveText('40,00');
});

test('a read-only role sees payments, balances and aging but gets no way to pay', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  const payables = new PayablesPage(page);

  await payables.open('pagos');
  await expect(page.getByTestId('payment-status-PAG000001')).toHaveText('Confirmado');
  await expect(page.getByTestId('new-payment')).toHaveCount(0);
  await expect(page.getByTestId('payment-options-PAG000001')).toHaveCount(0);

  await payables.open('facturas');
  await expect(page.getByTestId('payable-balance-FCP000001')).toBeVisible();
  await expect(page.getByTestId('payable-options-FCP000001')).toHaveCount(0);

  await payables.open('antiguedad');
  await expect(page.getByTestId('aging-balance-PRV000001')).toBeVisible();

  await payables.open('notas-de-credito');
  await expect(page.getByTestId('credit-note-status-NCP000001')).toHaveText('Confirmada');
  await expect(page.getByTestId('new-credit-note')).toHaveCount(0);
});

test('creates a supplier credit note selecting invoice line and shows origin NCP in inventory adjustments (H9 Correcciones 2 Ajuste 4)', async ({ page, request }) => {
  test.slow();
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const supplier = await aFreshSupplier(request, token, API);
  const invoice = await aConfirmedMerchandiseInvoice(request, token, supplier.id, 10, 10, API);
  const payables = new PayablesPage(page);
  const inventory = new InventoryPage(page);

  await new LoginPage(page).signIn(ACME_ADMIN);

  // 1. Abrir notas de crédito y abrir formulario de creación
  await payables.open('notas-de-credito');
  await page.getByTestId('new-credit-note').click();
  await expect(page.getByTestId('credit-note-panel')).toBeVisible();

  // 2. Seleccionar proveedor y factura afectada
  await page.getByTestId('credit-note-supplier').selectOption({ label: supplier.name });
  await page.getByTestId('credit-note-invoice').selectOption(invoice.id);

  // 3. Seleccionar la línea de la factura en la línea 0
  const lineSelect = page.getByTestId('credit-note-line-invoice-line-0');
  await expect(lineSelect).toBeVisible();
  await expect(lineSelect.locator('option')).toHaveCount(2);
  await lineSelect.selectOption({ index: 1 });

  // 4. Modificar el precio unitario a 25 para un descuento parcial y guardar
  await page.getByTestId('credit-note-line-price-0').fill('25');
  await page.getByTestId('credit-note-submit').click();
  await expect(page.getByTestId('credit-note-panel')).toBeHidden();

  // 5. Verificar que la fila de la nota de crédito aparece en estado Borrador
  const noteRow = payables.creditNoteOf(supplier.name);
  await expect(noteRow.getByTestId(/credit-note-status-/)).toHaveText('Borrador');
  const codeText = (await noteRow.locator('td').first().locator('p.font-mono').innerText()).trim();
  expect(codeText).toMatch(/^NCP\d+$/);

  // 6. Confirmar la nota de crédito desde las opciones de la fila
  await payables.act(noteRow, 'Confirmar');
  await expect(noteRow.getByTestId(/credit-note-status-/)).toHaveText('Confirmada');

  // 7. Navegar a Inventario -> Ajustes y comprobar el código de origen de la revaluación
  await inventory.open('ajustes');
  const adjRow = inventory.adjustmentWith(codeText);
  await expect(adjRow).toBeVisible();
  await expect(adjRow.getByTestId(/adjustment-status-/)).toHaveText('Borrador');
  await expect(adjRow.getByTestId(/adjustment-lines-/)).toContainText(`(${codeText})`);
});

