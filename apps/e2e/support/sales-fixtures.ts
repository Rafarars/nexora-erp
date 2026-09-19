import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACME_INVENTORY, aFreshItem, auth } from './inventory-fixtures.js';

export const CUSTOMERS = '/api/v1/sales/customers';
export const SALES_ORDERS = '/api/v1/sales/orders';
export const DISPATCHES = '/api/v1/sales/dispatches';
export const INVOICES = '/api/v1/sales/invoices';
export const AVAILABILITY = '/api/v1/sales/availability';

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export async function aFreshCustomer(request: APIRequestContext, token: string, paymentTermDays = 15, baseUrl = ''): Promise<{ id: string; name: string }> {
  const name = `Cliente ${unique()}`;
  const response = await request.post(`${baseUrl}${CUSTOMERS}`, { headers: auth(token), data: { name, paymentTermDays } });

  expect(response.status(), await response.text()).toBe(201);

  // Los listados paginan: hay que pedir el que se acaba de crear, no mirarlos todos.
  const { customers } = await (
    await request.get(`${baseUrl}${CUSTOMERS}?q=${encodeURIComponent(name)}`, { headers: auth(token) })
  ).json();

  return customers.find((customer: { name: string }) => customer.name === name);
}

// Un articulo propio con existencia en la bodega Principal, puesta por un ajuste confirmado a 1
// por unidad: las pruebas en paralelo no se reservan ni se despachan unas a otras.
export async function aStockedItem(request: APIRequestContext, token: string, quantity: number, baseUrl = '') {
  const item = await aFreshItem(request, token, baseUrl);
  const notes = `stock ${unique()}`;

  await request.post(`${baseUrl}/api/v1/inventory/adjustments`, {
    headers: auth(token),
    data: { warehouseId: ACME_INVENTORY.mainWarehouse, type: 'physical_count', notes, lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, direction: 'in', quantity, unitCost: 1 }] },
  });

  const { adjustments } = await (
    await request.get(`${baseUrl}/api/v1/inventory/adjustments?q=${encodeURIComponent(notes)}`, { headers: auth(token) })
  ).json();
  const adjustment = adjustments.find((candidate: { notes: string }) => candidate.notes === notes);

  expect((await request.put(`${baseUrl}/api/v1/inventory/adjustments/${adjustment.id}/confirm`, { headers: auth(token) })).status()).toBe(200);

  return item;
}

export async function aDraftSalesOrder(
  request: APIRequestContext,
  token: string,
  data: { customerId: string; lines: { itemId: string; unitId: string; quantity: number; unitPrice?: number }[]; date?: string; currency?: string; exchangeRate?: number; priceListId?: string },
  baseUrl = '',
) {
  const notes = `e2e ${unique()}`;
  const response = await request.post(`${baseUrl}${SALES_ORDERS}`, { headers: auth(token), data: { ...data, warehouseId: ACME_INVENTORY.mainWarehouse, notes } });

  expect(response.status(), await response.text()).toBe(201);

  // El buscador mira el codigo y el articulo, no las notas: se filtra por cliente, que si acota.
  const { orders } = await (
    await request.get(`${baseUrl}${SALES_ORDERS}?customerId=${data.customerId}`, { headers: auth(token) })
  ).json();

  return orders.find((order: { notes: string }) => order.notes === notes);
}

export async function aDraftDispatch(
  request: APIRequestContext,
  token: string,
  orderId: string,
  lines: { orderLineId: string; quantity: number }[],
  baseUrl = '',
  date?: string,
) {
  const notes = `e2e ${unique()}`;
  const response = await request.post(`${baseUrl}${DISPATCHES}`, { headers: auth(token), data: { orderId, notes, lines, date } });

  expect(response.status(), await response.text()).toBe(201);

  const { dispatches } = await (
    await request.get(`${baseUrl}${DISPATCHES}?orderId=${orderId}`, { headers: auth(token) })
  ).json();

  return dispatches.find((dispatch: { notes: string }) => dispatch.notes === notes);
}
