import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACME_INVENTORY, aFreshItem, auth, tokenFor } from '../../support/inventory-fixtures.js';
import { ORDERS, RECEIPTS, SUPPLIERS, aDraftOrder, aDraftReceipt, aFreshSupplier } from '../../support/purchasing-fixtures.js';

const put = (request: APIRequestContext, token: string, path: string) => request.put(path, { headers: auth(token) });

async function orderById(request: APIRequestContext, token: string, id: string) {
  const { orders } = await (await request.get(ORDERS, { headers: auth(token) })).json();

  return orders.find((order: { id: string }) => order.id === id);
}

async function stockOf(request: APIRequestContext, token: string, itemId: string) {
  const { stocks } = await (await request.get(`/api/v1/inventory/stock?warehouseId=${ACME_INVENTORY.mainWarehouse}`, { headers: auth(token) })).json();

  return stocks.find((stock: { item: { id: string } }) => stock.item.id === itemId);
}

async function incomingOf(request: APIRequestContext, token: string, itemId: string) {
  const { incoming } = await (await request.get('/api/v1/purchasing/incoming', { headers: auth(token) })).json();

  return incoming.find((row: { item: { id: string } }) => row.item.id === itemId);
}

// El mundo de cada prueba: un proveedor y un articulo propios, y una orden confirmada de 10
// cajas de 24 a 12 cada una.
async function aConfirmedOrder(request: APIRequestContext) {
  const token = await tokenFor(request, 'ana@acme.com');
  const [supplier, item] = await Promise.all([aFreshSupplier(request, token), aFreshItem(request, token)]);
  const order = await aDraftOrder(request, token, {
    supplierId: supplier.id,
    warehouseId: ACME_INVENTORY.mainWarehouse,
    lines: [{ itemId: item.id, unitId: ACME_INVENTORY.box, quantity: 10, unitCost: 12 }],
  });

  expect((await put(request, token, `${ORDERS}/${order.id}/confirm`)).status()).toBe(200);

  return { token, supplier, item, order: await orderById(request, token, order.id) };
}

test.describe('suppliers', () => {
  test('a supplier is created with its code, edited and deactivated, never deleted', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const supplier = await aFreshSupplier(request, token);

    expect(supplier).toMatchObject({ code: expect.stringMatching(/^PRV\d{6}$/), paymentTermDays: 30, isActive: true });

    const edit = await request.put(`${SUPPLIERS}/${supplier.id}`, {
      headers: auth(token),
      data: { name: supplier.name, fiscalId: 'J-40000000-1', email: 'compras@proveedor.com', paymentTermDays: 15 },
    });
    expect(edit.status()).toBe(200);
    expect((await request.put(`${SUPPLIERS}/${supplier.id}/status`, { headers: auth(token), data: { active: false } })).status()).toBe(200);

    const { suppliers } = await (await request.get(SUPPLIERS, { headers: auth(token) })).json();
    expect(suppliers.find((s: { id: string }) => s.id === supplier.id)).toMatchObject({ fiscalId: 'J-40000000-1', paymentTermDays: 15, isActive: false });
  });

  test('refuses a duplicate name and a bad email, without saying what was sent', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const supplier = await aFreshSupplier(request, token);

    const duplicate = await request.post(SUPPLIERS, { headers: auth(token), data: { name: supplier.name } });
    const email = await request.post(SUPPLIERS, { headers: auth(token), data: { name: `Otro ${Date.now()}`, email: 'sin-arroba' } });

    expect(duplicate.status()).toBe(409);
    expect(await duplicate.json()).toMatchObject({ error: 'DuplicateSupplierNameError' });
    expect(JSON.stringify(await duplicate.json())).not.toContain(supplier.name);
    expect(email.status()).toBe(400);
    expect((await email.json()).error).toBe('InvalidSupplierEmailError');
  });

  test('an inactive supplier receives no new orders', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const [supplier, item] = await Promise.all([aFreshSupplier(request, token), aFreshItem(request, token)]);
    await request.put(`${SUPPLIERS}/${supplier.id}/status`, { headers: auth(token), data: { active: false } });

    const response = await request.post(ORDERS, {
      headers: auth(token),
      data: { supplierId: supplier.id, warehouseId: ACME_INVENTORY.mainWarehouse, lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 1, unitCost: 1 }] },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('InactiveSupplierError');
  });
});

test.describe('purchase orders', () => {
  test('a draft announces nothing; the confirmed order announces the goods in transit', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const [supplier, item] = await Promise.all([aFreshSupplier(request, token), aFreshItem(request, token)]);
    const order = await aDraftOrder(request, token, {
      supplierId: supplier.id,
      warehouseId: ACME_INVENTORY.mainWarehouse,
      lines: [{ itemId: item.id, unitId: ACME_INVENTORY.box, quantity: 10, unitCost: 12 }],
    });

    expect(order).toMatchObject({
      code: expect.stringMatching(/^OC\d{6}$/),
      status: 'draft',
      supplier: { id: supplier.id, name: supplier.name },
      totals: { subtotal: 120, tax: 0, total: 120 },
      lines: [{ quantity: 10, baseQuantity: 240, pendingQuantity: 10 }],
    });
    expect(await incomingOf(request, token, item.id)).toBeUndefined();

    expect((await put(request, token, `${ORDERS}/${order.id}/confirm`)).status()).toBe(200);

    expect(await incomingOf(request, token, item.id)).toMatchObject({ quantity: 240, orders: [{ code: order.code, pendingQuantity: 240 }] });
    expect(await stockOf(request, token, item.id)).toBeUndefined();
  });

  test('a confirmed order can no longer be edited', async ({ request }) => {
    const { token, supplier, item, order } = await aConfirmedOrder(request);

    const response = await request.put(`${ORDERS}/${order.id}`, {
      headers: auth(token),
      data: { supplierId: supplier.id, warehouseId: ACME_INVENTORY.mainWarehouse, lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 1, unitCost: 1 }] },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('PurchaseOrderNotEditableError');
  });

  test('refuses an order for a service, with no lines or dated in the future', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const supplier = await aFreshSupplier(request, token);
    const base = { supplierId: supplier.id, warehouseId: ACME_INVENTORY.mainWarehouse };
    const item = await aFreshItem(request, token);

    const empty = await request.post(ORDERS, { headers: auth(token), data: { ...base, lines: [] } });
    const future = await request.post(ORDERS, {
      headers: auth(token),
      data: { ...base, date: '2999-01-01', lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 1, unitCost: 1 }] },
    });

    expect([(await empty.json()).error, (await future.json()).error]).toEqual(['EmptyPurchaseOrderError', 'FuturePurchaseDateError']);
  });
});

test.describe('goods receipts', () => {
  test('a partial receipt raises the stock, recalculates the average cost and leaves the rest in transit', async ({ request }) => {
    const { token, item, order } = await aConfirmedOrder(request);
    const receipt = await aDraftReceipt(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 4 }]);

    expect(receipt).toMatchObject({ code: expect.stringMatching(/^ENT\d{6}$/), status: 'draft', order: { code: order.code } });
    expect(await stockOf(request, token, item.id)).toBeUndefined();

    expect((await put(request, token, `${RECEIPTS}/${receipt.id}/confirm`)).status()).toBe(200);

    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 96, averageCost: 0.5 });
    expect(await orderById(request, token, order.id)).toMatchObject({ status: 'partially_received', lines: [{ receivedQuantity: 4, pendingQuantity: 6 }] });
    expect(await incomingOf(request, token, item.id)).toMatchObject({ quantity: 144 });

    const { movements } = await (await request.get(`/api/v1/inventory/items/${item.id}/movements`, { headers: auth(token) })).json();
    expect(movements).toMatchObject([{ direction: 'in', quantity: 96, unitCost: 0.5, origin: { type: 'receipt', code: receipt.code } }]);
  });

  test('receiving everything completes the order; a second receipt at another cost moves the average', async ({ request }) => {
    const { token, supplier, item, order } = await aConfirmedOrder(request);
    await put(request, token, `${RECEIPTS}/${(await aDraftReceipt(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 10 }])).id}/confirm`);

    expect((await orderById(request, token, order.id)).status).toBe('received');
    expect(await incomingOf(request, token, item.id)).toBeUndefined();

    const cheaper = await aDraftOrder(request, token, {
      supplierId: supplier.id,
      warehouseId: ACME_INVENTORY.mainWarehouse,
      lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 240, unitCost: 1 }],
    });
    await put(request, token, `${ORDERS}/${cheaper.id}/confirm`);
    await put(request, token, `${RECEIPTS}/${(await aDraftReceipt(request, token, cheaper.id, [{ orderLineId: cheaper.lines[0].id, quantity: 240 }])).id}/confirm`);

    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 480, averageCost: 0.75 });
  });

  // La guarda de la recepcion a traves de toda la pila: nunca entra mas de lo pedido.
  test('lets only one of two simultaneous receipts through when together they exceed the order', async ({ request }) => {
    const { token, item, order } = await aConfirmedOrder(request);
    const line = [{ orderLineId: order.lines[0].id, quantity: 6 }];
    const [first, second] = [await aDraftReceipt(request, token, order.id, line), await aDraftReceipt(request, token, order.id, line)];

    const responses = await Promise.all([put(request, token, `${RECEIPTS}/${first.id}/confirm`), put(request, token, `${RECEIPTS}/${second.id}/confirm`)]);

    expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 144 });
    expect((await orderById(request, token, order.id)).lines[0].receivedQuantity).toBe(6);
  });

  test('cancelling a receipt reverses the stock and steps the order back', async ({ request }) => {
    const { token, item, order } = await aConfirmedOrder(request);
    const receipt = await aDraftReceipt(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 10 }]);
    await put(request, token, `${RECEIPTS}/${receipt.id}/confirm`);

    expect((await put(request, token, `${ORDERS}/${order.id}/cancel`)).status()).toBe(409);
    expect((await put(request, token, `${RECEIPTS}/${receipt.id}/cancel`)).status()).toBe(200);

    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 0 });
    expect((await orderById(request, token, order.id)).status).toBe('confirmed');
    expect(await incomingOf(request, token, item.id)).toMatchObject({ quantity: 240 });

    // Sin nada recibido, la orden ya se puede anular y deja de anunciar mercancia.
    expect((await put(request, token, `${ORDERS}/${order.id}/cancel`)).status()).toBe(200);
    expect(await incomingOf(request, token, item.id)).toBeUndefined();
  });

  test('refuses to cancel a receipt whose goods already left the warehouse', async ({ request }) => {
    const { token, item, order } = await aConfirmedOrder(request);
    const receipt = await aDraftReceipt(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 1 }]);
    await put(request, token, `${RECEIPTS}/${receipt.id}/confirm`);
    const exit = await request.post('/api/v1/inventory/adjustments', {
      headers: auth(token),
      data: { warehouseId: ACME_INVENTORY.mainWarehouse, notes: `salida ${Date.now()}`, lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'out', quantity: 20 }] },
    });
    expect(exit.status()).toBe(201);
    const { adjustments } = await (await request.get('/api/v1/inventory/adjustments', { headers: auth(token) })).json();
    await put(request, token, `/api/v1/inventory/adjustments/${adjustments.find((a: { lines: { itemId: string }[] }) => a.lines[0]?.itemId === item.id).id}/confirm`);

    const response = await put(request, token, `${RECEIPTS}/${receipt.id}/cancel`);

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('ReceivedGoodsAlreadyUsedError');
    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 4 });
  });

  test('refuses a receipt larger than what is pending', async ({ request }) => {
    const { token, order } = await aConfirmedOrder(request);

    const response = await request.post(RECEIPTS, {
      headers: auth(token),
      data: { orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 10.5 }] },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('ReceiptExceedsPendingError');
  });
});

test.describe('purchasing: who can do what', () => {
  test('a read-only role sees orders, receipts and goods in transit but cannot buy', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');

    for (const path of [SUPPLIERS, ORDERS, RECEIPTS, '/api/v1/purchasing/incoming']) {
      expect((await request.get(path, { headers: auth(token) })).status(), path).toBe(200);
    }

    const create = await request.post(SUPPLIERS, { headers: auth(token), data: { name: 'No debería' } });
    expect(create.status()).toBe(403);
  });

  test('nothing in purchasing is reachable without a session', async ({ request }) => {
    for (const path of [SUPPLIERS, ORDERS, RECEIPTS, '/api/v1/purchasing/incoming']) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
  });
});

// Acme lleva sus cifras en dolares y tiene tasas legales sembradas: el dolar a 152,40 desde el 8 de
// septiembre y a 153,10 desde el 11; el euro a 175,05 desde el 11; y ninguna antes del 2 de enero.
test.describe('currency and exchange rates of purchases', () => {
  const aFreshWorld = async (request: APIRequestContext) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const [supplier, item] = await Promise.all([aFreshSupplier(request, token), aFreshItem(request, token)]);
    const order = (extra: { date?: string; currency?: string; exchangeRate?: number }) =>
      aDraftOrder(request, token, {
        supplierId: supplier.id,
        warehouseId: ACME_INVENTORY.mainWarehouse,
        lines: [{ itemId: item.id, unitId: ACME_INVENTORY.box, quantity: 10, unitCost: 12 }],
        ...extra,
      });

    return { token, supplier, item, order };
  };

  test('an order that does not say its currency is in the company one, with the rates of its date', async ({ request }) => {
    const { order } = await aFreshWorld(request);

    expect(await order({ date: '2026-09-09' })).toMatchObject({
      date: '2026-09-09',
      currency: 'USD',
      exchangeRate: 152.4,
      baseCurrency: 'USD',
      baseExchangeRate: 152.4,
      manualExchangeRate: false,
    });
  });

  // 10 cajas de 24 a 12 EUR son 240 unidades a 0,50 EUR, que en dolares son 0,50 x 175,05 / 153,10.
  test('goods bought in euros enter the stock at their cost in the company currency', async ({ request }) => {
    const { token, item, order } = await aFreshWorld(request);
    const draft = await order({ date: '2026-09-11', currency: 'EUR' });

    expect((await put(request, token, `${ORDERS}/${draft.id}/confirm`)).status()).toBe(200);
    expect(await orderById(request, token, draft.id)).toMatchObject({ currency: 'EUR', exchangeRate: 175.05, baseCurrency: 'USD', baseExchangeRate: 153.1 });

    const receipt = await aDraftReceipt(request, token, draft.id, [{ orderLineId: draft.lines[0].id, quantity: 10 }], '', { date: '2026-09-11' });

    expect(receipt).toMatchObject({ currency: 'EUR', exchangeRate: 175.05, baseExchangeRate: 153.1, manualExchangeRate: false });
    expect((await put(request, token, `${RECEIPTS}/${receipt.id}/confirm`)).status()).toBe(200);
    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 240, averageCost: 0.571685 });
  });

  test('a rate written by hand is kept through the confirmation, but not for the company currency', async ({ request }) => {
    const { token, supplier, item, order } = await aFreshWorld(request);
    const draft = await order({ date: '2026-09-11', currency: 'EUR', exchangeRate: 180.5 });

    expect(draft).toMatchObject({ exchangeRate: 180.5, baseExchangeRate: 153.1, manualExchangeRate: true });
    expect((await put(request, token, `${ORDERS}/${draft.id}/confirm`)).status()).toBe(200);
    expect(await orderById(request, token, draft.id)).toMatchObject({ status: 'confirmed', exchangeRate: 180.5, manualExchangeRate: true });

    const fixed = await request.post(ORDERS, {
      headers: auth(token),
      data: { supplierId: supplier.id, warehouseId: ACME_INVENTORY.mainWarehouse, currency: 'USD', exchangeRate: 150, lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 1, unitCost: 1 }] },
    });

    expect(fixed.status()).toBe(400);
    expect((await fixed.json()).error).toBe('FixedExchangeRateError');
  });

  test('an order dated before any rate is not saved', async ({ request }) => {
    const { token, supplier, item } = await aFreshWorld(request);
    const response = await request.post(ORDERS, {
      headers: auth(token),
      data: { supplierId: supplier.id, warehouseId: ACME_INVENTORY.mainWarehouse, date: '2025-12-31', currency: 'EUR', lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 1, unitCost: 1 }] },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('MissingExchangeRateError');
  });
});
