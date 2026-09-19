import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACME_INVENTORY, auth } from './inventory-fixtures.js';
import { CUSTOMERS, DISPATCHES, INVOICES, SALES_ORDERS, aDraftDispatch, aDraftSalesOrder, aStockedItem } from './sales-fixtures.js';

export const PAYMENTS = '/api/v1/receivables/payments';
export const RECEIVABLES = '/api/v1/receivables/invoices';
export const BALANCES = '/api/v1/receivables/customers';

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export async function aCreditCustomer(request: APIRequestContext, token: string, data: { paymentTermDays?: number; creditLimit?: number | null } = {}, baseUrl = '') {
  const name = `Cliente cobranza ${unique()}`;
  const response = await request.post(`${baseUrl}${CUSTOMERS}`, { headers: auth(token), data: { name, paymentTermDays: 15, ...data } });

  expect(response.status(), await response.text()).toBe(201);

  const { customers } = await (await request.get(`${baseUrl}${CUSTOMERS}`, { headers: auth(token) })).json();

  return customers.find((customer: { name: string }) => customer.name === name) as { id: string; name: string; code: string };
}

// Un despacho confirmado de `quantity` unidades a `unitPrice`, sin impuesto: lo facturado es
// quantity * unitPrice exacto. Articulo propio para no chocar con otras pruebas.
export async function aConfirmedDispatch(request: APIRequestContext, token: string, customerId: string, quantity = 10, unitPrice = 10, baseUrl = '') {
  const item = await aStockedItem(request, token, quantity, baseUrl);
  const order = await aDraftSalesOrder(request, token, { customerId, lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity, unitPrice }] }, baseUrl);

  expect((await request.put(`${baseUrl}${SALES_ORDERS}/${order.id}/confirm`, { headers: auth(token) })).status()).toBe(200);

  const confirmed = (
    await (await request.get(`${baseUrl}${SALES_ORDERS}?customerId=${order.customer.id}`, { headers: auth(token) })).json()
  ).orders.find((row: { id: string }) => row.id === order.id);
  const dispatch = await aDraftDispatch(request, token, order.id, [{ orderLineId: confirmed.lines[0].id, quantity }], baseUrl);

  expect((await request.put(`${baseUrl}${DISPATCHES}/${dispatch.id}/confirm`, { headers: auth(token) })).status()).toBe(200);

  return dispatch as { id: string; code: string };
}

export async function issue(request: APIRequestContext, token: string, dispatchId: string, date?: string, baseUrl = '') {
  return request.post(`${baseUrl}${INVOICES}`, { headers: auth(token), data: { dispatchId, date } });
}

export async function anInvoice(request: APIRequestContext, token: string, customerId: string, amount = 100, date?: string, baseUrl = '') {
  const dispatch = await aConfirmedDispatch(request, token, customerId, 10, amount / 10, baseUrl);
  const response = await issue(request, token, dispatch.id, date, baseUrl);

  expect(response.status(), await response.text()).toBe(201);

  const { invoices } = await (await request.get(`${baseUrl}${INVOICES}`, { headers: auth(token) })).json();

  return invoices.find((invoice: { dispatch: { id: string } }) => invoice.dispatch.id === dispatch.id) as { id: string; code: string; total: number };
}

export async function aDraftPayment(request: APIRequestContext, token: string, customerId: string, allocations: { invoiceId: string; amount: number }[], baseUrl = '') {
  const reference = `e2e ${unique()}`;
  const response = await request.post(`${baseUrl}${PAYMENTS}`, { headers: auth(token), data: { customerId, method: 'transfer', reference, allocations } });

  expect(response.status(), await response.text()).toBe(201);

  const { payments } = await (await request.get(`${baseUrl}${PAYMENTS}`, { headers: auth(token) })).json();

  return payments.find((payment: { reference: string }) => payment.reference === reference) as { id: string; code: string; amount: number };
}
