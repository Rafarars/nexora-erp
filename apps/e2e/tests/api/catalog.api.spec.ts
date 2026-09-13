import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const LOGIN = '/api/v1/auth/login';
const PASSWORD = 'Nexora-2026!';
const CATALOG = '/api/v1/catalog';

// Identificadores del catalogo de Acme que siembra el seed.
const ACME = {
  piece: 'e0000000-0000-4000-8000-000000000001',
  box: 'e0000000-0000-4000-8000-000000000002',
  drinks: 'e1000000-0000-4000-8000-000000000001',
  vat: 'e2000000-0000-4000-8000-000000000001',
  mainWarehouse: 'e3000000-0000-4000-8000-000000000001',
};

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function tokenFor(request: APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(LOGIN, { data: { email, password: PASSWORD } })).json()).token;
}

// Cada prueba nombra lo suyo con un sufijo propio: las del proyecto corren en paralelo
// y comparten la base.
const unique = (label: string) => `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function listed<T extends { name: string }>(
  request: APIRequestContext,
  token: string,
  resource: string,
  key: string,
): Promise<T[]> {
  return (await (await request.get(`${CATALOG}/${resource}`, { headers: auth(token) })).json())[key];
}

test.describe('catalog: categories', () => {
  test('creates a category with the next readable code and lists it', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const name = unique('Categoría');

    const created = await request.post(`${CATALOG}/categories`, { headers: auth(token), data: { name } });

    expect(created.status()).toBe(201);
    const category = (await listed<{ name: string; code: string; isActive: boolean }>(request, token, 'categories', 'categories')).find(
      (candidate) => candidate.name === name,
    );
    expect(category?.code).toMatch(/^CAT\d{6}$/);
    expect(category?.isActive).toBe(true);
  });

  test('rejects a repeated name with a code the interface can translate', async ({ request }) => {
    const response = await request.post(`${CATALOG}/categories`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: { name: 'Bebidas' },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('DuplicateCategoryNameError');
  });

  // La regla que el catalogo protege: lo que usa un articulo activo no se desactiva.
  test('refuses to deactivate a category that an active item uses', async ({ request }) => {
    const response = await request.put(`${CATALOG}/categories/${ACME.drinks}/status`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: { active: false },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('CategoryInUseError');
  });

  test('deactivates and reactivates a category nobody uses', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const name = unique('Temporal');
    await request.post(`${CATALOG}/categories`, { headers: auth(token), data: { name } });
    const { id } = (await listed<{ name: string; id: string }>(request, token, 'categories', 'categories')).find(
      (candidate) => candidate.name === name,
    )!;

    expect((await request.put(`${CATALOG}/categories/${id}/status`, { headers: auth(token), data: { active: false } })).status()).toBe(200);
    expect((await request.put(`${CATALOG}/categories/${id}/status`, { headers: auth(token), data: { active: true } })).status()).toBe(200);
  });
});

test.describe('catalog: measurement units and taxes', () => {
  test('rejects a repeated abbreviation', async ({ request }) => {
    const response = await request.post(`${CATALOG}/units`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: { name: unique('Pieza'), abbreviation: 'un' },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('DuplicateMeasurementUnitAbbreviationError');
  });

  test('refuses to deactivate a unit that an item uses as a secondary unit', async ({ request }) => {
    const response = await request.put(`${CATALOG}/units/${ACME.box}/status`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: { active: false },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('MeasurementUnitInUseError');
  });

  test('keeps a tax rate with decimals exactly as written', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const name = unique('IVA reducido');

    await request.post(`${CATALOG}/taxes`, { headers: auth(token), data: { name, rate: 8.5 } });

    const tax = (await listed<{ name: string; rate: number }>(request, token, 'taxes', 'taxes')).find((candidate) => candidate.name === name);
    expect(tax?.rate).toBe(8.5);
  });

  test('rejects a rate out of range and a rate sent as text', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    const outOfRange = await request.post(`${CATALOG}/taxes`, { headers: auth(token), data: { name: unique('Absurdo'), rate: 120 } });
    const asText = await request.post(`${CATALOG}/taxes`, { headers: auth(token), data: { name: unique('Texto'), rate: '16%' } });

    expect(outOfRange.status()).toBe(400);
    expect((await outOfRange.json()).error).toBe('InvalidTaxRateError');
    expect(asText.status()).toBe(400);
    expect((await asText.json()).fields).toEqual(['rate']);
  });
});

// Mover la bodega por defecto lo prueba la interfaz, en Initech: aqui solo se lee la de
// Acme, porque las pruebas corren en paralelo y otra podria estar comprobandola.
test.describe('catalog: warehouses', () => {
  test('refuses to deactivate the default warehouse', async ({ request }) => {
    const response = await request.put(`${CATALOG}/warehouses/${ACME.mainWarehouse}/status`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: { active: false },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('DefaultWarehouseDeactivationError');
  });
});

test.describe('catalog: items', () => {
  test('creates an item with a box of 24 and returns the names of what it uses', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const sku = `JUGO-${Date.now()}`;

    const response = await request.post(`${CATALOG}/items`, {
      headers: auth(token),
      data: {
        sku: sku.toLowerCase(),
        name: 'Jugo de naranja 1 l',
        type: 'inventoried',
        categoryId: ACME.drinks,
        taxId: ACME.vat,
        units: [
          { unitId: ACME.box, conversionFactor: 24, isBase: false },
          { unitId: ACME.piece, conversionFactor: 1, isBase: true },
        ],
      },
    });

    expect(response.status()).toBe(201);

    const { items } = await (await request.get(`${CATALOG}/items`, { headers: auth(token) })).json();
    const item = items.find((candidate: { sku: string }) => candidate.sku === sku);

    expect(item).toMatchObject({
      sku,
      code: expect.stringMatching(/^ART\d{6}$/),
      category: { id: ACME.drinks, name: 'Bebidas' },
      tax: { id: ACME.vat, name: 'IVA 16%', rate: 16 },
      units: [
        { unitId: ACME.piece, abbreviation: 'un', conversionFactor: 1, isBase: true },
        { unitId: ACME.box, abbreviation: 'cja', conversionFactor: 24, isBase: false },
      ],
    });
  });

  test('rejects a SKU already used, whatever its case', async ({ request }) => {
    const response = await request.post(`${CATALOG}/items`, {
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
    const response = await request.post(`${CATALOG}/items`, {
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
        request.post(`${CATALOG}/items`, {
          headers: auth(token),
          data: { sku, name: sku, type: 'service', units: [{ unitId: ACME.piece, conversionFactor: 1, isBase: true }] },
        }),
      ),
    );

    expect(responses.map((response) => response.status())).toEqual(skus.map(() => 201));

    const { items } = await (await request.get(`${CATALOG}/items`, { headers: auth(token) })).json();
    const codes = items.filter((item: { sku: string }) => skus.includes(item.sku)).map((item: { code: string }) => item.code);
    expect(new Set(codes).size).toBe(skus.length);
  });
});

test.describe('catalog: who can do what', () => {
  test('a read-only role lists the catalog but cannot change it', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');

    expect((await request.get(`${CATALOG}/items`, { headers: auth(token) })).status()).toBe(200);
    expect((await request.post(`${CATALOG}/categories`, { headers: auth(token), data: { name: unique('Colada') } })).status()).toBe(403);
    expect((await request.put(`${CATALOG}/taxes/${ACME.vat}`, { headers: auth(token), data: { name: 'Colado', rate: 0 } })).status()).toBe(403);
  });

  test('nothing in the catalog is reachable without a session', async ({ request }) => {
    for (const resource of ['categories', 'units', 'taxes', 'warehouses', 'items']) {
      expect((await request.get(`${CATALOG}/${resource}`)).status(), resource).toBe(401);
    }
  });

  test('an identifier that is not a UUID is a 400 that does not echo it back', async ({ request }) => {
    const response = await request.put(`${CATALOG}/items/no-es-un-uuid/status`, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: { active: false },
    });

    expect(response.status()).toBe(400);
    expect(await response.text()).not.toContain('no-es-un-uuid');
  });
});
