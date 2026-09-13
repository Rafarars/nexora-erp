import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACME_INVENTORY, aFreshItem, auth, tokenFor } from '../../support/inventory-fixtures.js';

const ADJUSTMENTS = '/api/v1/inventory/adjustments';

type Line = { itemId: string; unitId: string; direction: 'in' | 'out'; quantity: number; unitCost?: number };

// Crea un borrador y devuelve su id, buscandolo por las notas unicas que se le ponen.
async function draft(request: APIRequestContext, token: string, lines: Line[]): Promise<{ id: string; code: string }> {
  const notes = `e2e ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post(ADJUSTMENTS, {
    headers: auth(token),
    data: { warehouseId: ACME_INVENTORY.mainWarehouse, notes, lines },
  });

  expect(response.status(), await response.text()).toBe(201);

  const { adjustments } = await (await request.get(ADJUSTMENTS, { headers: auth(token) })).json();

  return adjustments.find((adjustment: { notes: string }) => adjustment.notes === notes);
}

async function stockOf(request: APIRequestContext, token: string, itemId: string): Promise<{ quantity: number; averageCost: number } | undefined> {
  const { stocks } = await (
    await request.get(`/api/v1/inventory/stock?warehouseId=${ACME_INVENTORY.mainWarehouse}`, { headers: auth(token) })
  ).json();

  return stocks.find((stock: { item: { id: string } }) => stock.item.id === itemId);
}

async function kardexOf(request: APIRequestContext, token: string, itemId: string) {
  return (await (await request.get(`/api/v1/inventory/items/${itemId}/movements`, { headers: auth(token) })).json()).movements;
}

const confirm = (request: APIRequestContext, token: string, id: string) =>
  request.put(`${ADJUSTMENTS}/${id}/confirm`, { headers: auth(token) });
const cancel = (request: APIRequestContext, token: string, id: string) =>
  request.put(`${ADJUSTMENTS}/${id}/cancel`, { headers: auth(token) });

test.describe('inventory adjustments', () => {
  test('a draft does not move stock; confirming it does, in base units and at the right cost', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    const adjustment = await draft(request, token, [
      { itemId: item.id, unitId: ACME_INVENTORY.box, direction: 'in', quantity: 2, unitCost: 12 },
    ]);

    expect(adjustment.code).toMatch(/^AJU\d{6}$/);
    expect(await stockOf(request, token, item.id)).toBeUndefined();

    expect((await confirm(request, token, adjustment.id)).status()).toBe(200);

    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 48, averageCost: 0.5 });
    expect(await kardexOf(request, token, item.id)).toMatchObject([
      { direction: 'in', quantity: 48, unitCost: 0.5, balanceQuantity: 48, origin: { code: adjustment.code }, isReversal: false },
    ]);
  });

  // La guarda de inventario en cero, y que el ajuste que la viola no deja nada escrito.
  test('refuses an exit larger than the stock and leaves the draft untouched', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    await confirm(request, token, (await draft(request, token, [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'in', quantity: 5, unitCost: 1 }])).id);
    const exit = await draft(request, token, [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'out', quantity: 6 }]);

    const response = await confirm(request, token, exit.id);

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('InsufficientStockError');
    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 5 });
    expect(await kardexOf(request, token, item.id)).toHaveLength(1);
  });

  test('cancelling a confirmed adjustment writes reversals and brings the stock back', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    const adjustment = await draft(request, token, [
      { itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'in', quantity: 10, unitCost: 2 },
    ]);
    await confirm(request, token, adjustment.id);

    expect((await cancel(request, token, adjustment.id)).status()).toBe(200);

    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 0 });
    expect((await kardexOf(request, token, item.id)).map((m: { direction: string; isReversal: boolean }) => [m.direction, m.isReversal])).toEqual([
      ['in', false],
      ['out', true],
    ]);
    expect((await cancel(request, token, adjustment.id)).status()).toBe(409);
  });

  // Dos salidas de 6 sobre 10, enviadas a la vez contra la API de verdad.
  test('lets only one of two simultaneous exits through', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    await confirm(request, token, (await draft(request, token, [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'in', quantity: 10, unitCost: 1 }])).id);
    const first = await draft(request, token, [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'out', quantity: 6 }]);
    const second = await draft(request, token, [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'out', quantity: 6 }]);

    const statuses = (await Promise.all([confirm(request, token, first.id), confirm(request, token, second.id)])).map((r) => r.status());

    expect(statuses.sort()).toEqual([200, 409]);
    expect(await stockOf(request, token, item.id)).toMatchObject({ quantity: 4 });
  });

  test('a confirmed adjustment can no longer be edited', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    const lines: Line[] = [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'in', quantity: 1, unitCost: 1 }];
    const adjustment = await draft(request, token, lines);
    await confirm(request, token, adjustment.id);

    const response = await request.put(`${ADJUSTMENTS}/${adjustment.id}`, {
      headers: auth(token),
      data: { warehouseId: ACME_INVENTORY.mainWarehouse, lines },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('AdjustmentNotEditableError');
  });

  test('rejects a line that cannot become stock', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    const post = (line: Record<string, unknown>) =>
      request.post(ADJUSTMENTS, { headers: auth(token), data: { warehouseId: ACME_INVENTORY.mainWarehouse, lines: [line] } });

    const service = await post({ itemId: 'e4000000-0000-4000-8000-000000000003', unitId: ACME_INVENTORY.piece, direction: 'in', quantity: 1 });
    const costOnExit = await post({ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'out', quantity: 1, unitCost: 3 });
    const zero = await post({ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'in', quantity: 0 });
    const future = await request.post(ADJUSTMENTS, {
      headers: auth(token),
      data: { warehouseId: ACME_INVENTORY.mainWarehouse, date: '2999-01-01', lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'in', quantity: 1 }] },
    });

    expect([(await service.json()).error, (await costOnExit.json()).error, (await zero.json()).error, (await future.json()).error]).toEqual([
      'ServiceHasNoStockError',
      'CostOnOutgoingLineError',
      'InvalidQuantityError',
      'FutureAdjustmentDateError',
    ]);
  });
});

test.describe('the catalog protects what has stock', () => {
  test('an item with stock cannot be deactivated, and its base unit cannot change', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const item = await aFreshItem(request, token);
    await confirm(request, token, (await draft(request, token, [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'in', quantity: 3, unitCost: 1 }])).id);

    const deactivate = await request.put(`/api/v1/catalog/items/${item.id}/status`, { headers: auth(token), data: { active: false } });
    const rebase = await request.put(`/api/v1/catalog/items/${item.id}`, {
      headers: auth(token),
      data: { sku: item.sku, name: item.name, type: 'inventoried', units: [{ unitId: ACME_INVENTORY.box, conversionFactor: 1, isBase: true }] },
    });

    expect((await deactivate.json()).error).toBe('ItemWithStockError');
    expect((await rebase.json()).error).toBe('ItemWithMovementsError');
  });
});

test.describe('inventory: who can do what', () => {
  test('a read-only role sees stock and kardex but cannot adjust', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');

    expect((await request.get('/api/v1/inventory/stock', { headers: auth(token) })).status()).toBe(200);
    expect((await request.get(ADJUSTMENTS, { headers: auth(token) })).status()).toBe(200);
    expect(
      (await request.post(ADJUSTMENTS, { headers: auth(token), data: { warehouseId: ACME_INVENTORY.mainWarehouse, lines: [] } })).status(),
    ).toBe(403);
    expect((await request.put(`${ADJUSTMENTS}/e5000000-0000-4000-8000-000000000002/confirm`, { headers: auth(token) })).status()).toBe(403);
  });

  test('nothing in the inventory is reachable without a session', async ({ request }) => {
    expect((await request.get('/api/v1/inventory/stock')).status()).toBe(401);
    expect((await request.get(ADJUSTMENTS)).status()).toBe(401);
  });
});
