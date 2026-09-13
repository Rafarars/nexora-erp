import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { InventoryPage } from '../../pages/inventory.page.js';
import { PurchasingPage } from '../../pages/purchasing.page.js';
import { aFreshItem, tokenFor } from '../../support/inventory-fixtures.js';
import { aFreshSupplier } from '../../support/purchasing-fixtures.js';

const API = process.env.API_URL ?? 'http://localhost:3001';

test.describe('Purchasing, from the screen', () => {
  // El recorrido del hito: pedir 10 cajas, ver que vienen en camino, recibir 4, ver la orden
  // recibida en parte y la existencia en el inventario, y anular la entrada para volver atras.
  // Con proveedor y articulo propios, para que ninguna prueba en paralelo los toque.
  test('orders, receives part of it, follows it into the stock and cancels the receipt', async ({ page, request }) => {
    const token = await tokenFor(request, ACME_ADMIN.email, API);
    const [item, supplier] = await Promise.all([aFreshItem(request, token, API), aFreshSupplier(request, token, API)]);
    const label = `${item.sku} — ${item.name}`;
    const notes = `Llegó parte ${item.sku}`;
    const purchasing = new PurchasingPage(page);
    const inventory = new InventoryPage(page);

    await new LoginPage(page).signIn(ACME_ADMIN);
    await purchasing.open('ordenes');
    await purchasing.createOrder(supplier.name, [{ item: label, quantity: '10', unit: 'cja', cost: '12' }]);

    const order = purchasing.orderOf(supplier.name);
    await expect(order.getByTestId(/order-status-/)).toHaveText('Borrador');
    await expect(order.getByTestId(/order-total-/)).toContainText('120,00');

    await purchasing.act(order, 'Confirmar');
    await expect(order.getByTestId(/order-status-/)).toHaveText('Confirmada');

    await purchasing.open('en-camino');
    await expect(purchasing.incomingOf(item.sku, 'Principal')).toHaveText('240 un');

    await purchasing.open('ordenes');
    await purchasing.startReceiving(purchasing.orderOf(supplier.name), ['4'], notes);
    await expect(page.getByTestId('receive-panel')).toBeHidden();

    await purchasing.open('entradas');
    const receipt = purchasing.receiptWith(notes);
    await expect(receipt.getByTestId(/receipt-status-/)).toHaveText('Borrador');
    await purchasing.act(receipt, 'Confirmar');
    await expect(receipt.getByTestId(/receipt-status-/)).toHaveText('Confirmada');

    await purchasing.open('ordenes');
    await expect(purchasing.orderOf(supplier.name).getByTestId(/order-status-/)).toHaveText('Recibida en parte');
    await expect(purchasing.orderOf(supplier.name).getByTestId(/order-lines-/)).toContainText('(4 recibidas)');

    await inventory.open('existencias');
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('96 un');

    await inventory.open('kardex');
    await page.getByTestId('kardex-item').selectOption({ label });
    await page.getByTestId('kardex-submit').click();
    await expect(page.getByTestId('kardex-origin-Principal-1')).toContainText('Entrada de compra');

    await purchasing.open('entradas');
    await purchasing.act(purchasing.receiptWith(notes), 'Anular (revierte la existencia)');
    await expect(purchasing.receiptWith(notes).getByTestId(/receipt-status-/)).toHaveText('Anulada');

    await purchasing.open('ordenes');
    await expect(purchasing.orderOf(supplier.name).getByTestId(/order-status-/)).toHaveText('Confirmada');

    await inventory.open('existencias');
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('0 un');
  });

  test('explains in Spanish that a receipt cannot bring more than what is pending', async ({ page, request }) => {
    const token = await tokenFor(request, ACME_ADMIN.email, API);
    const [item, supplier] = await Promise.all([aFreshItem(request, token, API), aFreshSupplier(request, token, API)]);
    const purchasing = new PurchasingPage(page);

    await new LoginPage(page).signIn(ACME_ADMIN);
    await purchasing.open('ordenes');
    await purchasing.createOrder(supplier.name, [{ item: `${item.sku} — ${item.name}`, quantity: '3', unit: 'un', cost: '1' }]);
    await purchasing.act(purchasing.orderOf(supplier.name), 'Confirmar');
    await expect(purchasing.orderOf(supplier.name).getByTestId(/order-status-/)).toHaveText('Confirmada');

    await purchasing.startReceiving(purchasing.orderOf(supplier.name), ['5'], `Demasiado ${item.sku}`);

    await expect(page.getByTestId('receive-error')).toHaveText('La entrada trae más de lo que queda pendiente en la orden.');
    await expect(page.getByTestId('receive-panel')).toBeVisible();
  });

  test('creates a supplier with its payment term and deactivates it', async ({ page }) => {
    const name = `Proveedor UI ${Date.now()}`;
    const purchasing = new PurchasingPage(page);

    await new LoginPage(page).signIn(ACME_ADMIN);
    await purchasing.open('proveedores');
    await page.getByTestId('new-supplier').click();
    await page.getByTestId('supplier-name').fill(name);
    await page.getByTestId('supplier-fiscal-id').fill('J-50000000-2');
    await page.getByTestId('supplier-term').fill('45');
    await page.getByTestId('supplier-submit').click();
    await expect(page.getByTestId('supplier-panel')).toBeHidden();

    await expect(page.getByTestId(`supplier-term-${name}`)).toHaveText('45 días');

    await page.getByTestId(`supplier-options-${name}`).click();
    await page.getByTestId(`supplier-toggle-status-${name}`).click();
    await expect(page.getByTestId(`supplier-status-${name}`)).toHaveText('Inactivo');
  });
});

test('a read-only role sees orders and goods in transit but gets no way to buy', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  const purchasing = new PurchasingPage(page);

  await purchasing.open('ordenes');
  await expect(page.getByTestId('order-status-OC000001')).toHaveText('Recibida en parte');
  await expect(page.getByTestId('new-order')).toHaveCount(0);
  await expect(page.getByTestId('order-options-OC000002')).toHaveCount(0);

  await purchasing.open('en-camino');
  await expect(purchasing.incomingOf('AGUA-500', 'Principal')).toHaveText('144 un');
  await expect(purchasing.incomingOf('DETERGENTE-1KG', 'Principal')).toHaveText('20 kg');
});
