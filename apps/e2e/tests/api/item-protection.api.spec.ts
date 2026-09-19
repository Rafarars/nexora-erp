import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACME_INVENTORY, aFreshItem, auth, tokenFor } from '../../support/inventory-fixtures.js';
import { ORDERS, RECEIPTS, aDraftOrder, aDraftReceipt, aFreshSupplier } from '../../support/purchasing-fixtures.js';
import { SALES_ORDERS, aDraftSalesOrder, aFreshCustomer, aStockedItem } from '../../support/sales-fixtures.js';

const ITEMS = '/api/v1/inventory/items';
const ADJUSTMENTS = '/api/v1/inventory/adjustments';
const { piece, box, mainWarehouse } = ACME_INVENTORY;

type Item = { id: string; sku: string; name: string };

// Lo que el maestro de articulos protege de un articulo que otros documentos ya usan. Cada prueba con su
// articulo, proveedor y cliente: corren en paralelo sobre la misma base.

const put = (request: APIRequestContext, token: string, path: string, data?: object) => request.put(path, { headers: auth(token), data });

function withUnits(request: APIRequestContext, token: string, item: Item, units: { unitId: string; conversionFactor: number; isBase: boolean }[]) {
  return put(request, token, `${ITEMS}/${item.id}`, { sku: item.sku, name: item.name, type: 'inventoried', units });
}

const baseAnd = (boxFactor?: number) => [
  { unitId: piece, conversionFactor: 1, isBase: true },
  ...(boxFactor === undefined ? [] : [{ unitId: box, conversionFactor: boxFactor, isBase: false }]),
];

const setActive = (request: APIRequestContext, token: string, itemId: string, active: boolean) =>
  put(request, token, `${ITEMS}/${itemId}/status`, { active });

async function orderById(request: APIRequestContext, token: string, id: string) {
  const { orders } = await (await request.get(ORDERS, { headers: auth(token) })).json();

  return orders.find((order: { id: string }) => order.id === id);
}

async function stockOf(request: APIRequestContext, token: string, itemId: string): Promise<number> {
  const { stocks } = await (await request.get(`/api/v1/inventory/stock?warehouseId=${mainWarehouse}`, { headers: auth(token) })).json();

  return stocks.find((stock: { item: { id: string } }) => stock.item.id === itemId)?.quantity ?? 0;
}

async function adjustment(request: APIRequestContext, token: string, itemId: string, direction: 'in' | 'out', quantity: number): Promise<string> {
  const notes = `e2e ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const line = { itemId, unitId: piece, direction, quantity, ...(direction === 'in' ? { unitCost: 1 } : {}) };

  expect((await request.post(ADJUSTMENTS, { headers: auth(token), data: { warehouseId: mainWarehouse, notes, lines: [line] } })).status()).toBe(201);

  const { adjustments } = await (await request.get(ADJUSTMENTS, { headers: auth(token) })).json();

  return adjustments.find((candidate: { notes: string }) => candidate.notes === notes).id;
}

async function confirmedPurchase(request: APIRequestContext, token: string, item: Item, boxes: number) {
  const supplier = await aFreshSupplier(request, token);
  const draft = await aDraftOrder(request, token, {
    supplierId: supplier.id,
    warehouseId: mainWarehouse,
    lines: [{ itemId: item.id, unitId: box, quantity: boxes, unitCost: 12 }],
  });

  expect((await put(request, token, `${ORDERS}/${draft.id}/confirm`)).status()).toBe(200);

  return orderById(request, token, draft.id);
}

async function expectRefused(response: Awaited<ReturnType<typeof put>>, error: string): Promise<void> {
  expect(response.status()).toBe(409);
  expect((await response.json()).error).toBe(error);
}

test.describe('an item that open orders use', () => {
  // La orden anuncio 10 cajas como 240 unidades: con otra caja, o sin caja, la entrada descuadraria
  // o no podria registrarse.
  test('keeps its box while a purchase order waits, and receives exactly what the order announced', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    const order = await confirmedPurchase(request, token, item, 10);

    await expectRefused(await withUnits(request, token, item, baseAnd(12)), 'ItemUnitInOpenDocumentsError');
    await expectRefused(await withUnits(request, token, item, baseAnd()), 'ItemUnitInOpenDocumentsError');

    const receipt = await aDraftReceipt(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 10 }]);
    expect((await put(request, token, `${RECEIPTS}/${receipt.id}/confirm`)).status()).toBe(200);
    expect(await stockOf(request, token, item.id)).toBe(240);

    // Recibida la orden, ya no promete nada: la caja se puede cambiar.
    expect((await withUnits(request, token, item, baseAnd(12))).status()).toBe(200);
  });

  test('cannot be deactivated while goods are in transit, and can once the order is cancelled', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    const order = await confirmedPurchase(request, token, item, 2);

    await expectRefused(await setActive(request, token, item.id, false), 'ItemInOpenDocumentsError');

    expect((await put(request, token, `${ORDERS}/${order.id}/cancel`)).status()).toBe(200);
    expect((await setActive(request, token, item.id, false)).status()).toBe(200);
  });

  // Un ajuste puede dejar la existencia en cero aunque haya reservas: el pedido sigue abierto y el
  // articulo no se puede desactivar.
  test('cannot be deactivated while a sales order reserves it, even with its stock at zero', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const [customer, item] = await Promise.all([aFreshCustomer(request, token), aStockedItem(request, token, 10)]);
    const order = await aDraftSalesOrder(request, token, { customerId: customer.id, lines: [{ itemId: item.id, unitId: piece, quantity: 5, unitPrice: 2 }] });
    expect((await put(request, token, `${SALES_ORDERS}/${order.id}/confirm`)).status()).toBe(200);

    const empty = await adjustment(request, token, item.id, 'out', 10);
    expect((await put(request, token, `${ADJUSTMENTS}/${empty}/confirm`)).status()).toBe(200);

    await expectRefused(await setActive(request, token, item.id, false), 'ItemInOpenDocumentsError');
  });
});

test.describe('stock and a deactivated item', () => {
  test('cancelling a document does not give stock back to an item that was deactivated', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    const entry = await adjustment(request, token, item.id, 'in', 5);
    expect((await put(request, token, `${ADJUSTMENTS}/${entry}/confirm`)).status()).toBe(200);
    const exit = await adjustment(request, token, item.id, 'out', 5);
    expect((await put(request, token, `${ADJUSTMENTS}/${exit}/confirm`)).status()).toBe(200);
    expect((await setActive(request, token, item.id, false)).status()).toBe(200);

    await expectRefused(await put(request, token, `${ADJUSTMENTS}/${exit}/cancel`), 'InactiveStockItemError');
    expect(await stockOf(request, token, item.id)).toBe(0);
  });
});

// Un borrador no bloquea el articulo, pero tampoco se confirma en silencio con otra caja.
test.describe('a draft whose box changed', () => {
  test('asks to be reviewed and saved before it is confirmed', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    const notes = `e2e ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const lines = [{ itemId: item.id, unitId: box, direction: 'in', quantity: 1, unitCost: 24 }];
    expect((await request.post(ADJUSTMENTS, { headers: auth(token), data: { warehouseId: mainWarehouse, notes, lines } })).status()).toBe(201);
    const { adjustments } = await (await request.get(ADJUSTMENTS, { headers: auth(token) })).json();
    const draft = adjustments.find((candidate: { notes: string }) => candidate.notes === notes);

    expect((await withUnits(request, token, item, baseAnd(12))).status()).toBe(200);
    await expectRefused(await put(request, token, `${ADJUSTMENTS}/${draft.id}/confirm`), 'StockItemChangedError');
    expect(await stockOf(request, token, item.id)).toBe(0);

    expect((await put(request, token, `${ADJUSTMENTS}/${draft.id}`, { warehouseId: mainWarehouse, notes, lines })).status()).toBe(200);
    expect((await put(request, token, `${ADJUSTMENTS}/${draft.id}/confirm`)).status()).toBe(200);
    expect(await stockOf(request, token, item.id)).toBe(12);
  });
});

// El articulo y el documento van en fila: de dos operaciones que se excluyen, pasa una sola.
test.describe('an item changed while a document is confirmed', () => {
  test('never ends up inactive with stock', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    for (let round = 0; round < 5; round += 1) {
      const item = await aFreshItem(request, token);
      const entry = await adjustment(request, token, item.id, 'in', 5);

      const [confirmed, deactivated] = await Promise.all([
        put(request, token, `${ADJUSTMENTS}/${entry}/confirm`),
        setActive(request, token, item.id, false),
      ]);

      expect([confirmed.status(), deactivated.status()].filter((status) => status === 200)).toHaveLength(1);
      expect(await stockOf(request, token, item.id)).toBe(confirmed.status() === 200 ? 5 : 0);
    }
  });

  test('never changes its base unit under its first movement', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    for (let round = 0; round < 5; round += 1) {
      const item = await aFreshItem(request, token);
      const entry = await adjustment(request, token, item.id, 'in', 3);

      const [confirmed, rebased] = await Promise.all([
        put(request, token, `${ADJUSTMENTS}/${entry}/confirm`),
        withUnits(request, token, item, [{ unitId: box, conversionFactor: 1, isBase: true }]),
      ]);

      expect([confirmed.status(), rebased.status()].filter((status) => status === 200)).toHaveLength(1);
      expect(await stockOf(request, token, item.id)).toBe(confirmed.status() === 200 ? 3 : 0);
    }
  });
});

// Lo que el articulo comprometio manda sobre lo que se le quiera cambiar, tambien en las banderas
// de comprar y vender, y en el aviso de reposicion.
test.describe('an item with open documents', () => {
  const trade = (request: APIRequestContext, token: string, item: Item, flags: { isPurchasable?: boolean; isSellable?: boolean }) =>
    put(request, token, `${ITEMS}/${item.id}`, { sku: item.sku, name: item.name, type: 'inventoried', units: baseAnd(24), ...flags });

  test('cannot stop being bought while a purchase order waits, and can again once it is cancelled', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    const order = await confirmedPurchase(request, token, item, 10);

    await expectRefused(await trade(request, token, item, { isPurchasable: false }), 'ItemStopsBeingTradedError');
    // Cada lado mira los suyos: una orden de compra no impide dejar de venderlo.
    expect((await trade(request, token, item, { isSellable: false })).status()).toBe(200);

    expect((await put(request, token, `${ORDERS}/${order.id}/cancel`)).status()).toBe(200);
    expect((await trade(request, token, item, { isPurchasable: false })).status()).toBe(200);
  });

  // Lo que ya viene del proveedor no hay que volver a pedirlo: sin esto, el aviso manda a comprar
  // dos veces lo mismo.
  test('stops asking to replenish what a purchase order is already bringing', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);

    await put(request, token, `${ITEMS}/${item.id}`, {
      sku: item.sku,
      name: item.name,
      type: 'inventoried',
      units: baseAnd(24),
      reorderRules: [{ warehouseId: mainWarehouse, minQuantity: 240, reorderQuantity: 240 }],
    });

    const lowStock = async () => {
      const { rows } = await (await request.get('/api/v1/inventory/low-stock', { headers: auth(token) })).json();

      return rows.find((row: { item: { id: string } }) => row.item.id === item.id);
    };

    expect(await lowStock()).toMatchObject({ quantity: 0, incoming: 0, projected: 0, missing: 240 });

    // Diez cajas de 24 son 240 en unidad base: justo el minimo, asi que deja de avisar.
    const order = await confirmedPurchase(request, token, item, 10);
    expect(await lowStock()).toBeUndefined();

    // Y si la orden se anula, vuelve a faltar todo.
    expect((await put(request, token, `${ORDERS}/${order.id}/cancel`)).status()).toBe(200);
    expect(await lowStock()).toMatchObject({ incoming: 0, projected: 0, missing: 240 });
  });
});
