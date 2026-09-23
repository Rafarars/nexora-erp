import { devices, expect, test } from '@playwright/test';
import { ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { InventoryPage } from '../../pages/inventory.page.js';
import { PurchasingPage } from '../../pages/purchasing.page.js';
import { ReceivablesPage } from '../../pages/receivables.page.js';
import { SalesPage } from '../../pages/sales.page.js';
import { seedDemoData } from '../../support/infrastructure.js';
import { ACME_INVENTORY, aFreshItem, auth, tokenFor } from '../../support/inventory-fixtures.js';
import { aDraftOrder, aDraftReceipt, aFreshSupplier, ORDERS, RECEIPTS } from '../../support/purchasing-fixtures.js';
import { aConfirmedDispatch, aCreditCustomer, anInvoice } from '../../support/receivables-fixtures.js';
import { aDraftDispatch, aDraftSalesOrder, aStockedItem } from '../../support/sales-fixtures.js';

const API = process.env.API_URL ?? 'http://localhost:3001';
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';

test.use({
  ...devices['Desktop Chrome'],
  baseURL: WEB,
});

test.describe.configure({ mode: 'serial' });

test.describe('destructive H8 credit note and returns UI workflows', () => {
  // Cada ejecución garantiza su estado inicial y restaura al terminar.
  test.beforeAll(async () => {
    seedDemoData();
  });

  test.afterAll(async () => {
    seedDemoData();
  });

  test('creates and confirms a sales return from a dispatch, and verifies inventory replenishment', async ({ page, request }) => {
    const token = await tokenFor(request, ACME_ADMIN.email, API);
    const customer = await aCreditCustomer(request, token, {}, API);

    // Creamos articulo propio, pedido y despacho confirmado
    const item = await aStockedItem(request, token, 4, API);
    const order = await aDraftSalesOrder(
      request,
      token,
      {
        customerId: customer.id,
        lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 4, unitPrice: 10 }],
      },
      API,
    );
    await request.put(`${API}/api/v1/sales/orders/${order.id}/confirm`, { headers: auth(token) });

    const { orders } = await (await request.get(`${API}/api/v1/sales/orders?customerId=${customer.id}`, { headers: auth(token) })).json();
    const confirmedOrder = orders.find((o: { id: string }) => o.id === order.id);

    const dispatch = await aDraftDispatch(request, token, order.id, [{ orderLineId: confirmedOrder.lines[0].id, quantity: 4 }], API);
    await request.put(`${API}/api/v1/sales/dispatches/${dispatch.id}/confirm`, { headers: auth(token) });

    const { dispatches } = await (await request.get(`${API}/api/v1/sales/dispatches?orderId=${order.id}`, { headers: auth(token) })).json();
    const confirmedDispatch = dispatches.find((d: { id: string }) => d.id === dispatch.id);
    const itemSku = item.sku;
    const lineId = confirmedDispatch.lines[0].id;

    await new LoginPage(page).signIn(ACME_ADMIN);
    const sales = new SalesPage(page);
    const inventory = new InventoryPage(page);

    // Comprobar que antes del reingreso la bodega no tiene unidades remanentes
    await inventory.openStock(itemSku);
    await expect(inventory.stockOf(itemSku, 'Principal')).toHaveText('0 un');

    // Crear devolucion de venta sobre el despacho desde la interfaz
    await sales.open('devoluciones');
    await page.getByTestId('btn-new-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();

    await page.getByTestId('sales-return-dispatch-select').selectOption(dispatch.id);
    await page.getByTestId('sales-return-condition-select').selectOption('resalable');
    await page.getByTestId('sales-return-reason-input').fill('Excedente devuelto por cliente');
    await page.getByTestId(`sales-return-qty-${lineId}`).fill('2');

    await page.getByTestId('btn-save-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeHidden();

    // Confirmar la devolucion en la tabla filtrando por su codigo unico
    const { returns: salesReturns } = await (
      await request.get(`${API}/api/v1/sales/returns?customerId=${customer.id}`, { headers: auth(token) })
    ).json();
    const createdReturn = salesReturns[0];
    const returnRow = page.getByTestId(`sales-return-row-${createdReturn.code}`);
    await expect(returnRow).toBeVisible();
    await expect(returnRow.getByTestId(`sales-return-status-${createdReturn.code}`)).toHaveText('Borrador');

    await sales.act(returnRow, 'Confirmar');
    await expect(returnRow.getByTestId(`sales-return-status-${createdReturn.code}`)).toHaveText('Confirmada');

    // Verificar el reingreso en inventario: la existencia en Principal subio a 2 unidades
    await inventory.openStock(itemSku);
    await expect(inventory.stockOf(itemSku, 'Principal')).toHaveText('2 un');
  });

  test('creates and confirms an originless sales return with manual cost from the UI, and verifies inventory replenishment (H8 §4.1 rule 3)', async ({
    page,
    request,
  }) => {
    const token = await tokenFor(request, ACME_ADMIN.email, API);
    const customer = await aCreditCustomer(request, token, {}, API);
    const item = await aFreshItem(request, token, API);

    await new LoginPage(page).signIn(ACME_ADMIN);
    const sales = new SalesPage(page);
    const inventory = new InventoryPage(page);

    // Comprobar que antes de la devolucion no existen existencias para el nuevo articulo
    await inventory.openStock(item.sku);
    await expect(page.getByTestId('stock-empty')).toBeVisible();

    // Crear devolucion sin despacho desde la UI
    await sales.open('devoluciones');
    await page.getByTestId('btn-new-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeVisible();

    await page.getByTestId('sales-return-dispatch-select').selectOption({ value: 'none' });
    await page.getByTestId('sales-return-customer-select').selectOption({ label: customer.name });
    await page.getByTestId('sales-return-warehouse-select').selectOption({ label: 'Principal' });
    await page.getByTestId('sales-return-item-0').selectOption(item.id);
    await page.getByTestId('sales-return-unit-0').selectOption(ACME_INVENTORY.piece);
    await page.getByTestId('sales-return-qty-0').fill('2');
    await page.getByTestId('sales-return-unit-cost-0').fill('3.75');

    await page.getByTestId('btn-save-sales-return').click();
    await expect(page.getByTestId('sales-return-create-panel')).toBeHidden();

    // Confirmar devolucion filtrando por su codigo unico
    const { returns } = await (
      await request.get(`${API}/api/v1/sales/returns?customerId=${customer.id}`, { headers: auth(token) })
    ).json();
    const createdReturn = returns[0];
    const returnRow = page.getByTestId(`sales-return-row-${createdReturn.code}`);
    await expect(returnRow).toBeVisible();
    await expect(returnRow.getByTestId(`sales-return-status-${createdReturn.code}`)).toHaveText('Borrador');

    await sales.act(returnRow, 'Confirmar');
    await expect(returnRow.getByTestId(`sales-return-status-${createdReturn.code}`)).toHaveText('Confirmada');

    // Verificar reingreso en inventario: 2 unidades y costo manual de 3,75
    await inventory.openStock(item.sku);
    const stockRow = page.getByTestId(`stock-row-${item.sku}-Principal`);
    await expect(stockRow).toBeVisible();
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('2 un');
    await expect(stockRow).toContainText('3,75');
  });

  test('issues credit note exceeding invoice balance, checks available credit, and spends it on another invoice in Collections', async ({
    page,
    request,
  }) => {
    const token = await tokenFor(request, ACME_ADMIN.email, API);
    const customer = await aCreditCustomer(request, token, { paymentTermDays: 30, creditLimit: 1000 }, API);

    // Factura 1: Total $30.00. Se cobra un anticipo de $20.00 para que deba solo $10.00
    const inv1 = await anInvoice(request, token, customer.id, 30, undefined, API);
    const ref = `ANTICIPO-${Date.now()}`;
    await request.post(`${API}/api/v1/receivables/payments`, {
      headers: auth(token),
      data: {
        customerId: customer.id,
        method: 'transfer',
        reference: ref,
        allocations: [{ invoiceId: inv1.id, amount: 20 }],
      },
    });
    const { payments } = await (
      await request.get(`${API}/api/v1/receivables/payments?customerId=${customer.id}`, { headers: auth(token) })
    ).json();
    const prePay = payments.find((p: { reference: string }) => p.reference === ref);
    await request.put(`${API}/api/v1/receivables/payments/${prePay.id}/confirm`, { headers: auth(token) });

    // Factura 2: $30.00 de saldo
    const inv2 = await anInvoice(request, token, customer.id, 30, undefined, API);

    await new LoginPage(page).signIn(ACME_ADMIN);
    const receivables = new ReceivablesPage(page);

    // 1. Emitir nota de credito por $25.00 afectando inv1 (que debe $10.00)
    await receivables.open('notas-de-credito');
    await page.getByTestId('new-credit-note').click();
    await expect(page.getByTestId('credit-note-panel')).toBeVisible();

    await page.getByTestId('credit-note-customer').selectOption({ label: customer.name });

    const inv1Option = page.locator('[data-testid="credit-note-invoice"] option').filter({ hasText: inv1.code });
    const inv1Value = await inv1Option.getAttribute('value');
    await page.getByTestId('credit-note-invoice').selectOption(inv1Value!);

    await page.locator('input[name="lineConcept"]').first().fill('Descuento especial por pronto pago');
    await page.locator('input[name="lineQuantity"]').first().fill('1');
    await page.locator('input[name="linePrice"]').first().fill('25');
    await page.locator('input[name="lineTax"]').first().fill('0');

    await page.getByTestId('credit-note-submit').click();
    await expect(page.getByTestId('credit-note-panel')).toBeHidden();

    // 2. Confirmar la nota
    const noteRow = page.locator('[data-testid^="credit-note-row-"]').filter({ hasText: customer.name });
    await expect(noteRow).toBeVisible();
    await expect(noteRow.getByTestId(/credit-note-status-/)).toHaveText('Borrador');

    await receivables.act(noteRow, 'Confirmar');
    await expect(noteRow.getByTestId(/credit-note-status-/)).toHaveText('Confirmada');

    // 3. Comprobar que la nota pago los 10 de inv1 y dejo 15 de credito disponible
    await expect(noteRow.getByTestId(/credit-note-available-/)).toHaveText('USD 15,00');

    // Obtener el id de la nota para usarlo en el cobro
    const { creditNotes } = await (
      await request.get(`${API}/api/v1/receivables/credit-notes?customerId=${customer.id}`, { headers: auth(token) })
    ).json();
    const createdNote = creditNotes.find((n: { customer: { id: string } }) => n.customer.id === customer.id);
    expect(createdNote).toBeDefined();

    // 4. Gastar 5 USD de ese credito desde la pantalla de Cobros en inv2
    await receivables.open('cobros');
    await page.getByTestId('new-payment').click();
    await expect(page.getByTestId('payment-panel')).toBeVisible();

    await page.getByTestId('payment-customer').selectOption({ label: customer.name });
    await expect(page.getByTestId('payment-customer-available-credit')).toContainText('15,00');
    await page.getByTestId('payment-method').selectOption('credit_note');
    const noteOption = page.locator('[data-testid="payment-credit-source"] option').filter({ hasText: createdNote.code });
    const noteValue = await noteOption.getAttribute('value');
    await page.getByTestId('payment-credit-source').selectOption(noteValue!);
    await page.getByTestId(`payment-allocation-${inv2.code}`).fill('5');

    await page.getByTestId('payment-submit').click();
    await expect(page.getByTestId('payment-panel')).toBeHidden();

    // 5. Confirmar el cobro
    const paymentRow = page.locator('[data-testid^="payment-row-"]').filter({ hasText: customer.name }).filter({ hasText: 'Borrador' });
    await expect(paymentRow.getByTestId(/payment-status-/)).toHaveText('Borrador');
    await receivables.act(paymentRow, 'Confirmar');
    await expect(page.locator('[data-testid^="payment-row-"]').filter({ hasText: customer.name }).first().getByTestId(/payment-status-/)).toHaveText('Confirmado');

    // 6. Volver a Notas de credito y comprobar que el saldo disponible bajo a 10 USD
    await receivables.open('notas-de-credito');
    const updatedNoteRow = page.locator('[data-testid^="credit-note-row-"]').filter({ hasText: customer.name });
    await expect(updatedNoteRow.getByTestId(/credit-note-available-/)).toHaveText('USD 10,00');

    // 7. En facturas, inv2 ahora debe 25 en vez de 30
    await receivables.open('facturas', inv2.code);
    await expect(page.getByTestId(`receivable-balance-${inv2.code}`)).toHaveText('25,00');
  });

  test('creates and confirms a purchase return from a goods receipt in the UI', async ({ page, request }) => {
    const token = await tokenFor(request, ACME_ADMIN.email, API);
    const item = await aFreshItem(request, token, API);
    const supplier = await aFreshSupplier(request, token, API);

    // Crear y confirmar orden de compra de 6 piezas
    const order = await aDraftOrder(
      request,
      token,
      {
        supplierId: supplier.id,
        warehouseId: ACME_INVENTORY.mainWarehouse,
        lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 6, unitCost: 15 }],
      },
      API,
    );
    await request.put(`${API}${ORDERS}/${order.id}/confirm`, { headers: auth(token) });

    const { orders } = await (await request.get(`${API}${ORDERS}?supplierId=${supplier.id}`, { headers: auth(token) })).json();
    const confirmedOrder = orders.find((o: { id: string }) => o.id === order.id);

    // Recibir la mercancia en entrada
    const receipt = await aDraftReceipt(request, token, order.id, [{ orderLineId: confirmedOrder.lines[0].id, quantity: 6 }], API);
    await request.put(`${API}${RECEIPTS}/${receipt.id}/confirm`, { headers: auth(token) });

    const { receipts } = await (await request.get(`${API}${RECEIPTS}?orderId=${order.id}`, { headers: auth(token) })).json();
    const confirmedReceipt = receipts.find((r: { id: string }) => r.id === receipt.id);
    const receiptLineId = confirmedReceipt.lines[0].id;

    // En la UI de compras
    await new LoginPage(page).signIn(ACME_ADMIN);
    const purchasing = new PurchasingPage(page);
    const inventory = new InventoryPage(page);

    // Comprobar existencia inicial de 6 piezas tras la recepcion
    await inventory.openStock(item.sku);
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('6 un');

    await purchasing.open('devoluciones');
    await page.getByTestId('btn-new-purchase-return').click();
    await expect(page.getByTestId('purchase-return-create-panel')).toBeVisible();

    await page.getByTestId('purchase-return-receipt-select').selectOption(receipt.id);
    await page.getByTestId('purchase-return-reason-input').fill('Defecto de fábrica detectado');
    await page.getByTestId(`purchase-return-qty-${receiptLineId}`).fill('2');

    await page.getByTestId('btn-save-purchase-return').click();
    await expect(page.getByTestId('purchase-return-create-panel')).toBeHidden();

    // Confirmar la devolucion de compra filtrando por su codigo unico
    const { returns: purchaseReturns } = await (
      await request.get(`${API}/api/v1/purchasing/returns?supplierId=${supplier.id}`, { headers: auth(token) })
    ).json();
    const createdReturn = purchaseReturns[0];
    const returnRow = page.getByTestId(`purchase-return-row-${createdReturn.code}`);
    await expect(returnRow).toBeVisible();
    await expect(returnRow.getByTestId(`purchase-return-status-${createdReturn.code}`)).toHaveText('Borrador');

    await purchasing.act(returnRow, 'Confirmar');
    await expect(returnRow.getByTestId(`purchase-return-status-${createdReturn.code}`)).toHaveText('Confirmada');

    // Verificar que la existencia en Principal bajo de 6 a 4 unidades
    await inventory.openStock(item.sku);
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('4 un');
  });
});
