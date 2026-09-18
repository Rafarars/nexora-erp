import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACME_INVENTORY } from '../../support/inventory-fixtures.js';
import { SALES_ORDERS, aDraftSalesOrder, aFreshCustomer, aStockedItem } from '../../support/sales-fixtures.js';

const LOGIN = '/api/v1/auth/login';
const PASSWORD = 'Nexora-2026!';
// El maestro de articulos vive en el inventario; sus categorias, impuestos y unidades, en el catalogo.
const ITEMS = '/api/v1/inventory/items';


// Identificadores del catalogo de Acme que siembra el seed.
const ACME = {
  piece: 'e0000000-0000-4000-8000-000000000001',
  box: 'e0000000-0000-4000-8000-000000000002',
  drinks: 'e1000000-0000-4000-8000-000000000001',
  vat: 'e2000000-0000-4000-8000-000000000001',
  exempt: 'e2000000-0000-4000-8000-000000000002',
};

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function tokenFor(request: APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(LOGIN, { data: { email, password: PASSWORD } })).json()).token;
}

test.describe('inventory: items', () => {
  test('creates an item with a box of 24 and returns the names of what it uses', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const sku = `JUGO-${Date.now()}`;
    const barcode = `759${Date.now()}`;

    const response = await request.post(`${ITEMS}`, {
      headers: auth(token),
      data: {
        sku: sku.toLowerCase(),
        name: 'Jugo de naranja 1 l',
        type: 'inventoried',
        categoryId: ACME.drinks,
        barcode,
        salesTaxId: ACME.vat,
        purchaseTaxId: ACME.exempt,
        units: [
          { unitId: ACME.box, conversionFactor: 24, isBase: false },
          { unitId: ACME.piece, conversionFactor: 1, isBase: true },
        ],
      },
    });

    expect(response.status()).toBe(201);

    const { items } = await (await request.get(`${ITEMS}?q=${sku}`, { headers: auth(token) })).json();
    const item = items.find((candidate: { sku: string }) => candidate.sku === sku);

    expect(item).toMatchObject({
      sku,
      code: expect.stringMatching(/^ART\d{6}$/),
      category: { id: ACME.drinks, name: 'Bebidas' },
      barcode,
      isPurchasable: true,
      isSellable: true,
      salesTax: { id: ACME.vat, name: 'IVA 16%', rate: 16 },
      purchaseTax: { id: ACME.exempt, name: 'Exento', rate: 0 },
      units: [
        { unitId: ACME.piece, abbreviation: 'un', conversionFactor: 1, isBase: true },
        { unitId: ACME.box, abbreviation: 'cja', conversionFactor: 24, isBase: false },
      ],
    });
  });

  // El lector de la caja tiene que llevar a un solo articulo.
  test('rejects a barcode another item already has', async ({ request }) => {
    const response = await request.post(`${ITEMS}`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: {
        sku: `CODIGO-${Date.now()}`,
        name: 'Con el codigo del agua',
        type: 'inventoried',
        barcode: '7591234567890',
        units: [{ unitId: ACME.piece, conversionFactor: 1, isBase: true }],
      },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('DuplicateBarcodeError');
  });

// Un documento dice lo que decia el maestro cuando se escribio: la factura vieja no cambia de nombre.
  test('a renamed item does not change the documents already written', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aFreshCustomer(request, token);
    const item = await aStockedItem(request, token, 5);
    const order = await aDraftSalesOrder(request, token, {
      customerId: customer.id,
      lines: [{ itemId: item.id, unitId: ACME.piece, quantity: 2, unitPrice: 3 }],
    });

    const renamed = await request.put(`${ITEMS}/${item.id}`, {
      headers: auth(token),
      data: { sku: `${item.sku}-NUEVO`, name: 'Nombre cambiado', type: 'inventoried', units: [{ unitId: ACME.piece, conversionFactor: 1, isBase: true }] },
    });

    expect(renamed.status(), await renamed.text()).toBe(200);

    const { orders } = await (await request.get(SALES_ORDERS, { headers: auth(token) })).json();
    const line = orders.find((row: { id: string }) => row.id === order.id).lines[0];

    expect(line).toMatchObject({ sku: item.sku, itemName: item.name });
  });

    // Un insumo que solo se compra no deberia poder colarse en un pedido de venta.
  test('refuses to sell an item that is not marked as sellable', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const sku = `INSUMO-${Date.now()}`;
    const created = await request.post(`${ITEMS}`, {
      headers: auth(token),
      data: { sku, name: 'Insumo interno', type: 'inventoried', isPurchasable: true, isSellable: false, units: [{ unitId: ACME.piece, conversionFactor: 1, isBase: true }] },
    });

    expect(created.status()).toBe(201);

    const { items } = await (await request.get(`${ITEMS}?q=${sku}`, { headers: auth(token) })).json();
    const item = items.find((row: { sku: string }) => row.sku === sku);
    const customer = await aFreshCustomer(request, token);
    const order = await request.post(SALES_ORDERS, {
      headers: auth(token),
      data: { customerId: customer.id, warehouseId: ACME_INVENTORY.mainWarehouse, lines: [{ itemId: item.id, unitId: ACME.piece, quantity: 1, unitPrice: 1 }] },
    });

    expect(order.status()).toBe(409);
    expect((await order.json()).error).toBe('ItemNotSellableError');
  });

// El maestro se pide por paginas y se filtra: un catalogo de miles no se trae entero.
  test('lists one page at a time and filters by text', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const first = await (await request.get(`${ITEMS}?limit=1`, { headers: auth(token) })).json();

    expect(first).toMatchObject({ limit: 1, offset: 0, hasMore: true });
    expect(first.items).toHaveLength(1);
    expect(first.total).toBeGreaterThan(1);

    const second = await (await request.get(`${ITEMS}?limit=1&offset=1`, { headers: auth(token) })).json();

    expect(second.items[0].sku).not.toBe(first.items[0].sku);

    const filtered = await (await request.get(`${ITEMS}?q=AGUA-500`, { headers: auth(token) })).json();

    expect(filtered.items.map((item: { sku: string }) => item.sku)).toEqual(['AGUA-500']);

    const byBarcode = await (await request.get(`${ITEMS}?q=7591234567890`, { headers: auth(token) })).json();

    expect(byBarcode.items.map((item: { sku: string }) => item.sku)).toEqual(['AGUA-500']);
    // La pagina tiene tope duro: pedir 500 es un 400, no medio maestro.
    expect((await request.get(`${ITEMS}?limit=500`, { headers: auth(token) })).status()).toBe(400);
  });

    test('rejects a SKU already used, whatever its case', async ({ request }) => {
    const response = await request.post(`${ITEMS}`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: {
        sku: 'agua-500',
        name: 'Duplicado',
        type: 'inventoried',
        units: [{ unitId: ACME.piece, conversionFactor: 1, isBase: true }],
      },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('DuplicateSkuError');
  });

  test('rejects units without a base one', async ({ request }) => {
    const response = await request.post(`${ITEMS}`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: {
        sku: `SIN-BASE-${Date.now()}`,
        name: 'Sin base',
        type: 'inventoried',
        units: [{ unitId: ACME.box, conversionFactor: 24, isBase: false }],
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe('InvalidItemUnitsError');
  });

  // Dos altas a la vez: el contador atomico no puede repetir el numero.
  test('gives different codes to items created at the same time', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const stamp = Date.now();
    const skus = Array.from({ length: 8 }, (_, index) => `PARALELO-${stamp}-${index}`);

    const responses = await Promise.all(
      skus.map((sku) =>
        request.post(`${ITEMS}`, {
          headers: auth(token),
          data: { sku, name: sku, type: 'service', units: [{ unitId: ACME.piece, conversionFactor: 1, isBase: true }] },
        }),
      ),
    );

    expect(responses.map((response) => response.status())).toEqual(skus.map(() => 201));

    const { items } = await (await request.get(`${ITEMS}?q=PARALELO-${stamp}&limit=50`, { headers: auth(token) })).json();
    const codes = items.filter((item: { sku: string }) => skus.includes(item.sku)).map((item: { code: string }) => item.code);
    expect(new Set(codes).size).toBe(skus.length);
  });
});

test.describe('inventory: who can do what with items', () => {
  test('a read-only role lists the items but cannot create one', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');
    const colado = { sku: `COLADO-${Date.now()}`, name: 'Colado', type: 'service', units: [{ unitId: ACME.piece, conversionFactor: 1, isBase: true }] };

    expect((await request.get(ITEMS, { headers: auth(token) })).status()).toBe(200);
    expect((await request.post(ITEMS, { headers: auth(token), data: colado })).status()).toBe(403);
  });

  test('the items are not reachable without a session', async ({ request }) => {
    expect((await request.get(ITEMS)).status()).toBe(401);
  });

  test('an identifier that is not a UUID is a 400 that does not echo it back', async ({ request }) => {
    const response = await request.put(`${ITEMS}/no-es-un-uuid/status`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: { active: false },
    });

    expect(response.status()).toBe(400);
    expect(await response.text()).not.toContain('no-es-un-uuid');
  });
});
