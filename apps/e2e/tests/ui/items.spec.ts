import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { CatalogPage } from '../../pages/catalog.page.js';
import { InventoryPage } from '../../pages/inventory.page.js';
import { ACME_INVENTORY, aFreshItem, auth, tokenFor } from '../../support/inventory-fixtures.js';
import { ORDERS, aDraftOrder, aFreshSupplier } from '../../support/purchasing-fixtures.js';
import { aStockedItem } from '../../support/sales-fixtures.js';

const API = process.env.API_URL ?? 'http://localhost:3001';

// Un articulo que una orden de compra confirmada usa en cajas.
async function anOrderedItem(request: APIRequestContext) {
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const [item, supplier] = await Promise.all([aFreshItem(request, token, API), aFreshSupplier(request, token, API)]);
  const draft = await aDraftOrder(
    request,
    token,
    { supplierId: supplier.id, warehouseId: ACME_INVENTORY.mainWarehouse, lines: [{ itemId: item.id, unitId: ACME_INVENTORY.box, quantity: 2, unitCost: 12 }] },
    API,
  );

  expect((await request.put(`${API}${ORDERS}/${draft.id}/confirm`, { headers: auth(token) })).status()).toBe(200);

  return item;
}

// Los articulos, ya en el inventario, con la misma tabla que el catalogo. Cada rechazo usa un
// articulo propio: las pruebas corren en paralelo sobre la misma base.
test.describe('The items, from the screen', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
  });

  test('explains a repeated SKU in Spanish and keeps the panel open', async ({ page }) => {
    const table = new CatalogPage(page);

    await new InventoryPage(page).open('articulos');
    await table.startCreating('item');
    await page.getByTestId('item-sku').fill('AGUA-500');
    await page.getByTestId('item-name').fill('Duplicado');
    await page.getByTestId('item-unit-0').selectOption({ label: 'Unidad (un)' });
    await page.getByTestId('item-unit-base-0').check();
    await table.submit('item');

    await expect(page.getByTestId('item-error')).toHaveText('Ya existe un artículo con ese SKU.');
    await expect(table.panel('item')).toBeVisible();
  });

  // Estos rechazos llegaban al panel como «Ese dato ya existe»: aqui se leen como son.
  test('explains why an item with stock cannot be deactivated', async ({ page, request }) => {
    const item = await aStockedItem(request, await tokenFor(request, ACME_ADMIN.email, API), 3, API);
    const table = new CatalogPage(page);

    const inventory = new InventoryPage(page);

    await inventory.open('articulos');
    await inventory.findItem(item.sku);
    await table.toggleStatus('item', item.sku);

    await expect(page.getByTestId('item-status-error')).toHaveText('El artículo todavía tiene existencia: no se puede desactivar.');
    await expect(table.status('item', item.sku)).toHaveText('Activo');
  });

  test('explains why an item with movements cannot become a service', async ({ page, request }) => {
    const item = await aStockedItem(request, await tokenFor(request, ACME_ADMIN.email, API), 3, API);
    const table = new CatalogPage(page);

    const inventory = new InventoryPage(page);

    await inventory.open('articulos');
    await inventory.findItem(item.sku);
    await table.startEditing('item', item.sku);
    await page.getByTestId('item-type').selectOption({ label: 'Servicio' });
    await table.submit('item');

    await expect(page.getByTestId('item-error')).toHaveText('El artículo ya tiene movimientos: su unidad base y su tipo no pueden cambiar.');
    await expect(table.panel('item')).toBeVisible();
  });

  test('explains why the box an open purchase order uses cannot change', async ({ page, request }) => {
    const item = await anOrderedItem(request);
    const table = new CatalogPage(page);

    const inventory = new InventoryPage(page);

    await inventory.open('articulos');
    await inventory.findItem(item.sku);
    await table.startEditing('item', item.sku);
    await page.getByTestId('item-unit-factor-1').fill('12');
    await table.submit('item');

    await expect(page.getByTestId('item-error')).toHaveText(
      'Una orden de compra o un pedido de venta abierto usa esa unidad: no se puede quitar ni cambiar su factor hasta cerrarlo.',
    );
  });

  test('explains why an item an open purchase order uses cannot be deactivated', async ({ page, request }) => {
    const item = await anOrderedItem(request);
    const table = new CatalogPage(page);

    const inventory = new InventoryPage(page);

    await inventory.open('articulos');
    await inventory.findItem(item.sku);
    await table.toggleStatus('item', item.sku);

    await expect(page.getByTestId('item-status-error')).toHaveText(
      'El artículo está en órdenes de compra o pedidos de venta abiertos: recíbelos, despáchalos o anúlalos primero.',
    );
  });
});

test('a read-only role sees the items but gets no way to change them', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  const table = new CatalogPage(page);

  await new InventoryPage(page).open('articulos');

  await expect(table.row('item', 'AGUA-500')).toBeVisible();
  await expect(page.getByTestId('new-item')).toHaveCount(0);
  await expect(page.getByTestId('item-options-AGUA-500')).toHaveCount(0);
});
