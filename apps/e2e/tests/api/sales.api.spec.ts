import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACME_INVENTORY, auth, tokenFor } from '../../support/inventory-fixtures.js';
import { AVAILABILITY, CUSTOMERS, DISPATCHES, INVOICES, SALES_ORDERS, aDraftDispatch, aDraftSalesOrder, aFreshCustomer, aStockedItem } from '../../support/sales-fixtures.js';

const put = (request: APIRequestContext, token: string, path: string) => request.put(path, { headers: auth(token) });
const piece = ACME_INVENTORY.piece;

async function find(request: APIRequestContext, token: string, path: string, key: string, id: string) {
  return (await (await request.get(path, { headers: auth(token) })).json())[key].find((row: { id: string }) => row.id === id);
}

async function availabilityOf(request: APIRequestContext, token: string, itemId: string) {
  const { availability } = await (await request.get(`${AVAILABILITY}?warehouseId=${ACME_INVENTORY.mainWarehouse}`, { headers: auth(token) })).json();

  return availability.find((row: { item: { id: string } }) => row.item.id === itemId);
}

// El mundo de cada prueba: un cliente de 15 dias y un articulo propio con existencia.
async function aConfirmedSale(request: APIRequestContext, stock = 100, quantity = 40, unitPrice = 2.5) {
  const token = await tokenFor(request, 'ana@acme.com');
  const [customer, item] = await Promise.all([aFreshCustomer(request, token), aStockedItem(request, token, stock)]);
  const order = await aDraftSalesOrder(request, token, { customerId: customer.id, lines: [{ itemId: item.id, unitId: piece, quantity, unitPrice }] });

  expect((await put(request, token, `${SALES_ORDERS}/${order.id}/confirm`)).status()).toBe(200);

  return { token, customer, item, order: await find(request, token, SALES_ORDERS, 'orders', order.id) };
}

test.describe('customers', () => {
  test('a customer is created with its code and payment term, and a duplicate name is refused', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aFreshCustomer(request, token, 30);

    expect(customer).toMatchObject({ code: expect.stringMatching(/^CLI\d{6}$/), paymentTermDays: 30, isActive: true });

    const duplicate = await request.post(CUSTOMERS, { headers: auth(token), data: { name: customer.name } });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).error).toBe('DuplicateCustomerNameError');
  });
});

test.describe('sales orders', () => {
  test('a draft reserves nothing; confirming reserves without moving the stock', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const [customer, item] = await Promise.all([aFreshCustomer(request, token), aStockedItem(request, token, 100)]);
    const order = await aDraftSalesOrder(request, token, { customerId: customer.id, lines: [{ itemId: item.id, unitId: piece, quantity: 40, unitPrice: 2.5 }] });

    expect(order).toMatchObject({ code: expect.stringMatching(/^PED\d{6}$/), status: 'draft', totals: { subtotal: 100, tax: 0, total: 100 } });
    expect(await availabilityOf(request, token, item.id)).toMatchObject({ onHand: 100, reserved: 0, available: 100 });

    expect((await put(request, token, `${SALES_ORDERS}/${order.id}/confirm`)).status()).toBe(200);

    expect(await availabilityOf(request, token, item.id)).toMatchObject({ onHand: 100, reserved: 40, available: 60 });
  });

  // La regla central del pedido, a traves de toda la pila.
  test('refuses to reserve more than what is available', async ({ request }) => {
    const { token, customer, item } = await aConfirmedSale(request, 100, 70);
    const second = await aDraftSalesOrder(request, token, { customerId: customer.id, lines: [{ itemId: item.id, unitId: piece, quantity: 31, unitPrice: 1 }] });

    const response = await put(request, token, `${SALES_ORDERS}/${second.id}/confirm`);

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('InsufficientAvailabilityError');
    expect(await availabilityOf(request, token, item.id)).toMatchObject({ reserved: 70, available: 30 });
  });

  test('lets only one of two simultaneous orders reserve when both do not fit', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const [customer, item] = await Promise.all([aFreshCustomer(request, token), aStockedItem(request, token, 10)]);
    const line = [{ itemId: item.id, unitId: piece, quantity: 6, unitPrice: 1 }];
    const [first, second] = [await aDraftSalesOrder(request, token, { customerId: customer.id, lines: line }), await aDraftSalesOrder(request, token, { customerId: customer.id, lines: line })];

    const responses = await Promise.all([put(request, token, `${SALES_ORDERS}/${first.id}/confirm`), put(request, token, `${SALES_ORDERS}/${second.id}/confirm`)]);

    expect(responses.map((r) => r.status()).sort()).toEqual([200, 409]);
    expect(await availabilityOf(request, token, item.id)).toMatchObject({ reserved: 6, available: 4 });
  });
});

test.describe('dispatches and invoices', () => {
  test('a dispatch lowers the stock at the average cost and releases that part of the reservation', async ({ request }) => {
    const { token, item, order } = await aConfirmedSale(request);
    const dispatch = await aDraftDispatch(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 15 }]);

    expect((await put(request, token, `${DISPATCHES}/${dispatch.id}/confirm`)).status()).toBe(200);

    expect(await availabilityOf(request, token, item.id)).toMatchObject({ onHand: 85, reserved: 25, available: 60 });
    expect(await find(request, token, SALES_ORDERS, 'orders', order.id)).toMatchObject({ status: 'partially_dispatched', lines: [{ dispatchedQuantity: 15 }] });

    const { movements } = await (await request.get(`/api/v1/inventory/items/${item.id}/movements`, { headers: auth(token) })).json();
    expect(movements.at(-1)).toMatchObject({ direction: 'out', quantity: 15, unitCost: 1, origin: { type: 'dispatch', code: dispatch.code } });
  });

  test('an invoice charges the dispatch at the order price, does not touch the stock and blocks cancelling the dispatch', async ({ request }) => {
    const { token, item, order } = await aConfirmedSale(request);
    const dispatch = await aDraftDispatch(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 10 }]);
    await put(request, token, `${DISPATCHES}/${dispatch.id}/confirm`);

    const issued = await request.post(INVOICES, { headers: auth(token), data: { dispatchId: dispatch.id } });
    expect(issued.status(), await issued.text()).toBe(201);

    const { invoices } = await (await request.get(INVOICES, { headers: auth(token) })).json();
    const invoice = invoices.find((candidate: { dispatch: { id: string } }) => candidate.dispatch.id === dispatch.id);
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(`${today}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 15);

    expect(invoice).toMatchObject({ code: expect.stringMatching(/^FAC\d{6}$/), status: 'issued', issueDate: today, dueDate: due.toISOString().slice(0, 10), total: 25 });
    expect(await availabilityOf(request, token, item.id)).toMatchObject({ onHand: 90 });

    const again = await request.post(INVOICES, { headers: auth(token), data: { dispatchId: dispatch.id } });
    expect([again.status(), (await again.json()).error]).toEqual([409, 'DispatchAlreadyInvoicedError']);

    const blocked = await put(request, token, `${DISPATCHES}/${dispatch.id}/cancel`);
    expect([blocked.status(), (await blocked.json()).error]).toEqual([409, 'DispatchInvoicedError']);

    expect((await put(request, token, `${INVOICES}/${invoice.id}/cancel`)).status()).toBe(200);
    expect((await put(request, token, `${DISPATCHES}/${dispatch.id}/cancel`)).status()).toBe(200);
    expect(await availabilityOf(request, token, item.id)).toMatchObject({ onHand: 100, reserved: 40 });
  });

  test('refuses a dispatch the warehouse no longer has, and changes nothing', async ({ request }) => {
    const { token, item, order } = await aConfirmedSale(request, 50, 50);
    const dispatch = await aDraftDispatch(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 50 }]);
    const notes = `salida ${Date.now()}`;
    await request.post('/api/v1/inventory/adjustments', {
      headers: auth(token),
      data: { warehouseId: ACME_INVENTORY.mainWarehouse, notes, lines: [{ itemId: item.id, unitId: piece, direction: 'out', quantity: 45 }] },
    });
    const { adjustments } = await (await request.get('/api/v1/inventory/adjustments', { headers: auth(token) })).json();
    await put(request, token, `/api/v1/inventory/adjustments/${adjustments.find((a: { notes: string }) => a.notes === notes).id}/confirm`);

    const response = await put(request, token, `${DISPATCHES}/${dispatch.id}/confirm`);

    expect([response.status(), (await response.json()).error]).toEqual([409, 'InsufficientStockForDispatchError']);
    expect((await find(request, token, SALES_ORDERS, 'orders', order.id)).status).toBe('confirmed');
  });
});

test.describe('sales: who can do what', () => {
  test('a read-only role sees orders, dispatches, invoices and availability but cannot sell', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');

    for (const path of [CUSTOMERS, SALES_ORDERS, DISPATCHES, INVOICES, AVAILABILITY]) {
      expect((await request.get(path, { headers: auth(token) })).status(), path).toBe(200);
    }

    expect((await request.post(CUSTOMERS, { headers: auth(token), data: { name: 'No debería' } })).status()).toBe(403);
  });

  test('nothing in sales is reachable without a session', async ({ request }) => {
    for (const path of [CUSTOMERS, SALES_ORDERS, DISPATCHES, INVOICES, AVAILABILITY]) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
  });
});

// Acme lleva sus cifras en dolares. Tasas legales sembradas: el euro a 171,30 desde el 1 de septiembre
// y a 175,05 desde el 11; el dolar a 153,10 desde el 11.
test.describe('currency and exchange rates of sales', () => {
  // La ley pide la tasa del dia de la factura, no la del pedido que le dio origen.
  test('an invoice takes the currency of its order with the rates of the day it is issued, and its amounts in bolivars', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const [customer, item] = await Promise.all([aFreshCustomer(request, token), aStockedItem(request, token, 10)]);
    const order = await aDraftSalesOrder(request, token, {
      customerId: customer.id,
      date: '2026-09-10',
      currency: 'EUR',
      lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 10, unitPrice: 10 }],
    });

    expect(order).toMatchObject({ currency: 'EUR', exchangeRate: 171.3, baseCurrency: 'USD', manualExchangeRate: false });
    expect((await request.put(`${SALES_ORDERS}/${order.id}/confirm`, { headers: auth(token) })).status()).toBe(200);

    const dispatch = await aDraftDispatch(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 10 }]);
    expect((await request.put(`${DISPATCHES}/${dispatch.id}/confirm`, { headers: auth(token) })).status()).toBe(200);
    expect((await request.post(INVOICES, { headers: auth(token), data: { dispatchId: dispatch.id } })).status()).toBe(201);

    const { invoices } = await (await request.get(INVOICES, { headers: auth(token) })).json();
    const invoice = invoices.find((row: { dispatch: { id: string } }) => row.dispatch.id === dispatch.id);

    expect(invoice).toMatchObject({ currency: 'EUR', exchangeRate: 175.05, baseCurrency: 'USD', baseExchangeRate: 153.1 });
    expect(invoice.totalVes).toBe(Math.round(invoice.total * 175.05 * 100) / 100);
  });

  test('a sales order keeps a rate written by hand when it is confirmed', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const [customer, item] = await Promise.all([aFreshCustomer(request, token), aStockedItem(request, token, 5)]);
    const order = await aDraftSalesOrder(request, token, {
      customerId: customer.id,
      currency: 'EUR',
      exchangeRate: 180.5,
      lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 5, unitPrice: 2 }],
    });

    expect((await request.put(`${SALES_ORDERS}/${order.id}/confirm`, { headers: auth(token) })).status()).toBe(200);

    const { orders } = await (await request.get(SALES_ORDERS, { headers: auth(token) })).json();
    expect(orders.find((row: { id: string }) => row.id === order.id)).toMatchObject({ status: 'confirmed', exchangeRate: 180.5, manualExchangeRate: true });
  });
});
