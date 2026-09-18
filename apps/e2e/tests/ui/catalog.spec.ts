import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, INITECH_ADMIN, LoginPage } from '../../pages/login.page.js';
import { CatalogPage } from '../../pages/catalog.page.js';
import { InventoryPage } from '../../pages/inventory.page.js';

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

test.describe('The catalog, from the screen', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
  });

  // El recorrido completo del hito: crear lo que alimenta a un articulo, crear el
  // articulo (ya en el inventario) con una caja de 24, verlo en el listado y comprobar que la categoria queda
  // protegida mientras el articulo este activo.
  test('creates a category and an item that uses it, and protects the category while the item is active', async ({
    page,
  }) => {
    const catalog = new CatalogPage(page);
    const inventory = new InventoryPage(page);
    const id = stamp();
    const categoryName = `Congelados ${id}`;
    const sku = `HELADO-${id}`.toUpperCase();

    await catalog.open('categorias');
    await catalog.startCreating('category');
    await page.getByTestId('category-name').fill(categoryName);
    await catalog.submitAndClose('category');
    await expect(catalog.row('category', categoryName)).toBeVisible();
    await expect(page.getByTestId(`category-code-${categoryName}`)).toHaveText(/^CAT\d{6}$/);

    await inventory.open('articulos');
    await catalog.startCreating('item');
    await page.getByTestId('item-sku').fill(sku.toLowerCase());
    await page.getByTestId('item-name').fill('Helado de vainilla 1 l');
    await page.getByTestId('item-category').selectOption({ label: categoryName });
    await page.getByTestId('item-sales-tax').selectOption({ label: 'IVA 16% (16 %)' });
    await page.getByTestId('item-purchase-tax').selectOption({ label: 'Exento (0 %)' });
    await page.getByTestId('item-unit-0').selectOption({ label: 'Unidad (un)' });
    await page.getByTestId('item-unit-base-0').check();
    await page.getByTestId('item-unit-add').click();
    await page.getByTestId('item-unit-1').selectOption({ label: 'Caja (cja)' });
    await page.getByTestId('item-unit-factor-1').fill('24');
    await catalog.submitAndClose('item');

    // El SKU se guarda en mayusculas: la fila se busca como quedo.
    await expect(catalog.row('item', sku)).toBeVisible();
    await expect(page.getByTestId(`item-category-${sku}`)).toHaveText(categoryName);
    await expect(page.getByTestId(`item-units-${sku}`)).toHaveText('un · 1 cja = 24 un');

    await catalog.open('categorias');
    await catalog.toggleStatus('category', categoryName);
    await expect(page.getByTestId('category-status-error')).toHaveText(
      'No se puede desactivar: hay artículos activos en esta categoría.',
    );
    await expect(catalog.status('category', categoryName)).toHaveText('Activo');

    await inventory.open('articulos');
    await catalog.toggleStatus('item', sku);
    await expect(catalog.status('item', sku)).toHaveText('Inactivo');

    await catalog.open('categorias');
    await catalog.toggleStatus('category', categoryName);
    await expect(catalog.status('category', categoryName)).toHaveText('Inactivo');
  });

  test('accepts a tax rate written with a decimal comma', async ({ page }) => {
    const catalog = new CatalogPage(page);
    const name = `Reducido ${stamp()}`;

    await catalog.open('impuestos');
    await catalog.startCreating('tax');
    await page.getByTestId('tax-name').fill(name);
    await page.getByTestId('tax-rate').fill('8,5');
    await catalog.submitAndClose('tax');

    await expect(page.getByTestId(`tax-rate-${name}`)).toHaveText('8,5 %');
  });

  test('edits a unit from the row options', async ({ page }) => {
    const catalog = new CatalogPage(page);
    const inventory = new InventoryPage(page);
    const id = stamp();
    const name = `Paquete ${id}`;
    const renamed = `Paquete grande ${id}`;

    await catalog.open('unidades');
    await catalog.startCreating('unit');
    await page.getByTestId('unit-name').fill(name);
    await page.getByTestId('unit-abbreviation').fill(`pq${id.slice(-5)}`);
    await catalog.submitAndClose('unit');

    await catalog.startEditing('unit', name);
    await expect(page.getByTestId('unit-name')).toHaveValue(name);
    await page.getByTestId('unit-name').fill(renamed);
    await catalog.submitAndClose('unit');

    await expect(catalog.row('unit', renamed)).toBeVisible();
    await expect(catalog.row('unit', name)).toHaveCount(0);
  });

  test('refuses to deactivate the default warehouse and says why', async ({ page }) => {
    const catalog = new CatalogPage(page);

    await catalog.open('bodegas');
    await expect(page.getByTestId('warehouse-default-Principal')).toBeVisible();

    await catalog.toggleStatus('warehouse', 'Principal');

    await expect(page.getByTestId('warehouse-status-error')).toHaveText(
      'No se puede desactivar la bodega por defecto. Elige otra por defecto primero.',
    );
    await expect(catalog.status('warehouse', 'Principal')).toHaveText('Activo');
  });
});

// En Initech y no en Acme: la bodega por defecto existe una vez por empresa, y moverla
// donde otras pruebas la leen las haria fallar de vez en cuando.
test('moves the default mark to another warehouse and back', async ({ page }) => {
  await new LoginPage(page).signIn(INITECH_ADMIN);
  const catalog = new CatalogPage(page);

  await catalog.open('bodegas');
  await expect(page.getByTestId('warehouse-default-Principal')).toBeVisible();

  await page.getByTestId('warehouse-options-Secundaria').click();
  await page.getByTestId('warehouse-make-default-Secundaria').click();

  await expect(page.getByTestId('warehouse-default-Secundaria')).toBeVisible();
  await expect(page.getByTestId('warehouse-default-Principal')).toHaveCount(0);

  // Ya no se ofrece marcar la que es por defecto; la otra si.
  await page.getByTestId('warehouse-options-Secundaria').click();
  await expect(page.getByTestId('warehouse-toggle-status-Secundaria')).toBeVisible();
  await expect(page.getByTestId('warehouse-make-default-Secundaria')).toHaveCount(0);
  await page.getByTestId('warehouse-options-Secundaria').click();

  await page.getByTestId('warehouse-options-Principal').click();
  await page.getByTestId('warehouse-make-default-Principal').click();
  await expect(page.getByTestId('warehouse-default-Principal')).toBeVisible();
});

test('a read-only role sees the catalog but gets no way to change it', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  const catalog = new CatalogPage(page);

  await catalog.open('categorias');

  await expect(catalog.row('category', 'Bebidas')).toBeVisible();
  await expect(page.getByTestId('new-category')).toHaveCount(0);
  await expect(page.getByTestId('category-options-Bebidas')).toHaveCount(0);
});

// Un rol sin ningun permiso de catalogo no ve el modulo: ni el enlace de la barra ni la
// pantalla si escribe la direccion a mano.
test('the catalog module does not show up for a role without catalog permissions', async ({ page, request }) => {
  const api = process.env.API_URL ?? 'http://localhost:3001';
  const email = `sin-catalogo-${stamp()}@acme.com`;
  const password = 'a-long-password';
  const roleName = `Solo usuarios ${stamp()}`;

  const login = await request.post(`${api}/api/v1/auth/login`, { data: ACME_ADMIN });
  const headers = { authorization: `Bearer ${(await login.json()).token}` };

  await request.post(`${api}/api/v1/roles`, { headers, data: { name: roleName, permissions: ['access.users.search'] } });
  const { roles } = await (await request.get(`${api}/api/v1/roles`, { headers })).json();
  const role = roles.find((candidate: { name: string }) => candidate.name === roleName);
  await request.post(`${api}/api/v1/users`, {
    headers,
    data: { email, password, name: 'Sin Catálogo', roleIds: [role.id] },
  });

  await new LoginPage(page).signIn({ email, password });

  await expect(page.getByTestId('nav-panel')).toBeVisible();
  await expect(page.getByTestId('nav-catalogo')).toHaveCount(0);
  await expect(page.getByTestId('nav-inventario')).toHaveCount(0);

  await page.goto('/catalogo');
  await expect(page.getByTestId('catalog-forbidden')).toBeVisible();

  await page.goto('/catalogo/categorias');
  await expect(page.getByTestId('categories-forbidden')).toBeVisible();
});
