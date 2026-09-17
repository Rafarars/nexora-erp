import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { InventoryPage } from '../../pages/inventory.page.js';
import { PurchasingPage } from '../../pages/purchasing.page.js';
import { SalesPage } from '../../pages/sales.page.js';
import { aFreshItem, tokenFor } from '../../support/inventory-fixtures.js';
import { aFreshSupplier } from '../../support/purchasing-fixtures.js';
import { aFreshCustomer, aStockedItem } from '../../support/sales-fixtures.js';

const API = process.env.API_URL ?? 'http://localhost:3001';

// El ciclo completo del ERP escrito como escenario: cada paso es un Dado, Cuando o Entonces. Con
// articulo, proveedor y cliente propios, para que ninguna prueba en paralelo mueva lo suyo.
test('the whole cycle from the screen: buy, receive, sell, dispatch and invoice', async ({ page, request }) => {
  // Son seis pantallas seguidas: con la suite entera en marcha no entra en el minuto de las demas.
  test.slow();

  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const [item, supplier, customer] = await Promise.all([aFreshItem(request, token, API), aFreshSupplier(request, token, API), aFreshCustomer(request, token, 15, API)]);
  const label = `${item.sku} — ${item.name}`;
  const purchasing = new PurchasingPage(page);
  const sales = new SalesPage(page);
  const inventory = new InventoryPage(page);

  await test.step('Dado que la administradora de Acme inició sesión', async () => {
    await new LoginPage(page).signIn(ACME_ADMIN);
  });

  await test.step('Cuando le compra 10 cajas al proveedor y recibe toda la mercancía', async () => {
    await purchasing.open('ordenes');
    await purchasing.createOrder(supplier.name, [{ item: label, quantity: '10', unit: 'cja', cost: '12' }]);
    await purchasing.act(purchasing.orderOf(supplier.name), 'Confirmar');
    await expect(purchasing.orderOf(supplier.name).getByTestId(/order-status-/)).toHaveText('Confirmada');
    await purchasing.startReceiving(purchasing.orderOf(supplier.name), ['10'], `Compra ${item.sku}`);
    await expect(page.getByTestId('receive-panel')).toBeHidden();
    await purchasing.open('entradas');
    await purchasing.act(purchasing.receiptWith(`Compra ${item.sku}`), 'Confirmar');
    await expect(purchasing.receiptWith(`Compra ${item.sku}`).getByTestId(/receipt-status-/)).toHaveText('Confirmada');
  });

  await test.step('Entonces hay 240 unidades disponibles para vender', async () => {
    await sales.open('disponibilidad');
    await expect(sales.availableOf(item.sku, 'Principal')).toHaveText('240 un');
  });

  await test.step('Cuando el cliente pide 4 cajas y el pedido se confirma', async () => {
    await sales.open('pedidos');
    await sales.createOrder(customer.name, { item: label, quantity: '4', unit: 'cja', price: '30' });
    await sales.act(sales.orderOf(customer.name), 'Confirmar');
    await expect(sales.orderOf(customer.name).getByTestId(/sales-order-status-/)).toHaveText('Confirmado');
  });

  await test.step('Entonces 96 unidades quedan reservadas y la existencia no se mueve', async () => {
    await sales.open('disponibilidad');
    await expect(sales.reservedOf(item.sku, 'Principal')).toHaveText('96 un');
    await expect(sales.availableOf(item.sku, 'Principal')).toHaveText('144 un');
    await inventory.open('existencias');
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('240 un');
  });

  await test.step('Cuando se despachan las 4 cajas', async () => {
    await sales.open('pedidos');
    await sales.startDispatching(sales.orderOf(customer.name), ['4'], `Entrega ${item.sku}`);
    await expect(page.getByTestId('dispatch-panel')).toBeHidden();
    await sales.open('despachos');
    await sales.act(sales.dispatchWith(`Entrega ${item.sku}`), 'Confirmar');
    await expect(sales.dispatchWith(`Entrega ${item.sku}`).getByTestId(/dispatch-status-/)).toContainText('Confirmado');
  });

  await test.step('Entonces la existencia baja a 144 y el kardex muestra la compra y el despacho', async () => {
    await inventory.open('existencias');
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('144 un');
    await inventory.open('kardex');
    await page.getByTestId('kardex-item').selectOption({ label });
    await page.getByTestId('kardex-submit').click();
    await expect(page.getByTestId('kardex-origin-Principal-1')).toContainText('Entrada de compra');
    await expect(page.getByTestId('kardex-origin-Principal-2')).toContainText('Despacho');
  });

  await test.step('Cuando se factura el despacho', async () => {
    await sales.open('despachos');
    await sales.act(sales.dispatchWith(`Entrega ${item.sku}`), 'Facturar');
    await expect(sales.dispatchWith(`Entrega ${item.sku}`).getByTestId(/dispatch-status-/)).toContainText('FAC');
  });

  await test.step('Entonces la factura cobra 4 cajas a 30 más IVA y la existencia sigue en 144', async () => {
    await sales.open('facturas');
    await expect(sales.invoiceOf(customer.name).getByTestId(/invoice-status-/)).toHaveText('Emitida');
    await expect(sales.invoiceOf(customer.name).getByTestId(/invoice-total-/)).toContainText('120,00');
    await inventory.open('existencias');
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('144 un');
  });
});

test('explains in Spanish that an order does not fit in what is available', async ({ page, request }) => {
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const [item, customer] = await Promise.all([aStockedItem(request, token, 5, API), aFreshCustomer(request, token, 0, API)]);
  const sales = new SalesPage(page);

  await new LoginPage(page).signIn(ACME_ADMIN);
  await sales.open('pedidos');
  await sales.createOrder(customer.name, { item: `${item.sku} — ${item.name}`, quantity: '6', unit: 'un', price: '1' });
  await sales.act(sales.orderOf(customer.name), 'Confirmar');

  await expect(page.getByTestId('sales-order-action-error')).toHaveText('No hay existencia disponible suficiente para reservar este pedido.');
  await expect(sales.orderOf(customer.name).getByTestId(/sales-order-status-/)).toHaveText('Borrador');
});

// React reinicia un formulario al terminar su accion: sin cuidarlo, un rechazo borraba cliente y
// articulo, y la moneda volvia a USD en pantalla mientras el formulario seguia creyendo que era EUR.
test('a refused order keeps what was written, and saves in the chosen currency once corrected', async ({ page, request }) => {
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const customer = await aFreshCustomer(request, token, 15, API);
  const sales = new SalesPage(page);

  await new LoginPage(page).signIn(ACME_ADMIN);
  await sales.open('pedidos');
  await page.getByTestId('new-sales-order').click();
  await page.getByTestId('sales-order-customer').selectOption({ label: customer.name });
  await page.getByTestId('sales-order-currency').selectOption('EUR');
  await page.getByTestId('sales-order-line-item-0').selectOption({ label: 'AGUA-500 — Agua mineral 500 ml' });
  await page.getByTestId('sales-order-line-quantity-0').fill('2');
  await page.getByTestId('sales-order-line-price-0').fill('30,1234567');
  await page.getByTestId('sales-order-submit').click();

  await expect(page.getByTestId('sales-order-error')).toBeVisible();
  await expect(page.getByTestId('sales-order-customer')).toHaveValue(customer.id);
  await expect(page.getByTestId('sales-order-currency')).toHaveValue('EUR');
  await expect(page.getByTestId('sales-order-line-item-0')).not.toHaveValue('');

  await page.getByTestId('sales-order-line-price-0').fill('30,12');
  await page.getByTestId('sales-order-submit').click();

  await expect(sales.orderOf(customer.name).getByTestId(/sales-order-total-/)).toContainText('EUR');
});

test('a read-only role sees orders, invoices and availability but gets no way to sell', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  const sales = new SalesPage(page);

  await sales.open('pedidos');
  await expect(page.getByTestId('sales-order-status-PED000001')).toHaveText('Despachado en parte');
  await expect(page.getByTestId('new-sales-order')).toHaveCount(0);
  await expect(page.getByTestId('sales-order-options-PED000002')).toHaveCount(0);

  await sales.open('facturas');
  await expect(page.getByTestId('invoice-status-FAC000001')).toHaveText('Emitida');
  await expect(page.getByTestId('invoice-due-FAC000001')).toHaveText('2026-09-22');

  await sales.open('disponibilidad');
  await expect(sales.reservedOf('AGUA-500', 'Principal')).toHaveText('72 un');
  await expect(sales.availableOf('DETERGENTE-1KG', 'Principal')).toHaveText('40 kg');
});
