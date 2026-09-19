import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { InventoryPage } from '../../pages/inventory.page.js';
import { PurchasingPage } from '../../pages/purchasing.page.js';
import { ACME_INVENTORY, aFreshItem, tokenFor } from '../../support/inventory-fixtures.js';
import { aDraftOrder, aFreshSupplier } from '../../support/purchasing-fixtures.js';

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

    await inventory.openStock(item.sku);
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

    await inventory.openStock(item.sku);
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('0 un');
  });

  // La tasa la escribio una persona: la orden la muestra con su total en bolivares, y al editarla la
  // moneda y la tasa vuelven a sus campos.
  test('shows the rate an order froze and its total in bolivars', async ({ page, request }) => {
    const token = await tokenFor(request, ACME_ADMIN.email, API);
    const [item, supplier] = await Promise.all([aFreshItem(request, token, API), aFreshSupplier(request, token, API)]);
    const order = await aDraftOrder(
      request,
      token,
      {
        supplierId: supplier.id,
        warehouseId: ACME_INVENTORY.mainWarehouse,
        date: '2026-09-11',
        currency: 'EUR',
        exchangeRate: 180.5,
        lines: [{ itemId: item.id, unitId: ACME_INVENTORY.box, quantity: 10, unitCost: 12 }],
      },
      API,
    );
    const purchasing = new PurchasingPage(page);

    await new LoginPage(page).signIn(ACME_ADMIN);
    await purchasing.open('ordenes');

    await expect(page.getByTestId(`order-total-${order.code}`)).toContainText('EUR 120,00');
    await expect(page.getByTestId(`order-rate-${order.code}`)).toHaveText('EUR a 180,50 Bs. (a mano) · Bs. 21660,00');

    await page.getByTestId(`order-options-${order.code}`).click();
    await page.getByTestId(`order-edit-${order.code}`).click();

    await expect(page.getByTestId('order-currency')).toHaveValue('EUR');
    await expect(page.getByTestId('order-exchange-rate')).toHaveValue('180,50');

    await page.getByTestId('order-currency').selectOption('USD');
    await expect(page.getByTestId('order-exchange-rate')).toHaveCount(0);
  });

  test('explains in Spanish that a receipt cannot bring more than what is pending', async ({ page, request }) => {
    const token = await tokenFor(request, ACME_ADMIN.email, API);
    const [item, supplier] = await Promise.all([aFreshItem(request, token, API), aFreshSupplier(request, token, API)]);
    const purchasing = new PurchasingPage(page);

    await new LoginPage(page).signIn(ACME_ADMIN);
    await purchasing.open('ordenes');
    await purchasing.createOrder(supplier.name, [{ item: `${item.sku} — ${item.name}`, quantity: '3', unit: 'un', cost: '1' }]);
    await purchasing.filterOrdersBySupplier(supplier.name);
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

    // El listado pagina: hay que buscarlo, no darlo por visible.
    await purchasing.search('proveedores', name);
    await expect(page.getByTestId(`supplier-term-${name}`)).toHaveText('45 días');

    await page.getByTestId(`supplier-options-${name}`).click();
    await page.getByTestId(`supplier-toggle-status-${name}`).click();
    await expect(page.getByTestId(`supplier-status-${name}`)).toHaveText('Inactivo');
  });
});

test('a read-only role sees orders and goods in transit but gets no way to buy', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  const purchasing = new PurchasingPage(page);

  // Los listados paginan: las ordenes de la demostracion son las de codigo mas bajo, asi que
  // cualquier orden que otra prueba cree las empuja fuera de la primera pagina.
  await purchasing.open('ordenes', 'OC000001');
  await expect(page.getByTestId('order-status-OC000001')).toHaveText('Recibida en parte');
  await expect(page.getByTestId('new-order')).toHaveCount(0);

  await purchasing.search('ordenes', 'OC000002');
  await expect(page.getByTestId('order-options-OC000002')).toHaveCount(0);

  await purchasing.open('en-camino', 'AGUA-500');
  await expect(purchasing.incomingOf('AGUA-500', 'Principal')).toHaveText('144 un');

  await purchasing.search('en-camino', 'DETERGENTE-1KG');
  await expect(purchasing.incomingOf('DETERGENTE-1KG', 'Principal')).toHaveText('20 kg');
});
