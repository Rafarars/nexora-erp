import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { auth } from './inventory-fixtures.js';

export const SUPPLIERS = '/api/v1/purchasing/suppliers';
export const ORDERS = '/api/v1/purchasing/orders';
export const RECEIPTS = '/api/v1/purchasing/receipts';

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Un proveedor propio por prueba, por la misma razon que un articulo propio: las pruebas
// corren en paralelo sobre la misma base.
export async function aFreshSupplier(request: APIRequestContext, token: string, baseUrl = ''): Promise<{ id: string; name: string; code: string }> {
  const name = `Proveedor ${unique()}`;
  const response = await request.post(`${baseUrl}${SUPPLIERS}`, { headers: auth(token), data: { name, paymentTermDays: 30 } });

  expect(response.status(), await response.text()).toBe(201);

  // Los listados paginan: hay que pedir el que se acaba de crear, no mirarlos todos.
  const { suppliers } = await (await request.get(`${baseUrl}${SUPPLIERS}?q=${encodeURIComponent(name)}`, { headers: auth(token) })).json();

  return suppliers.find((supplier: { name: string }) => supplier.name === name);
}

export interface OrderLine {
  itemId: string;
  unitId: string;
  quantity: number;
  unitCost: number;
}

// Crea una orden en borrador y la devuelve, buscandola por sus notas unicas.
export async function aDraftOrder(
  request: APIRequestContext,
  token: string,
  data: { supplierId: string; warehouseId: string; lines: OrderLine[]; date?: string; currency?: string; exchangeRate?: number },
  baseUrl = '',
) {
  const notes = `e2e ${unique()}`;
  const response = await request.post(`${baseUrl}${ORDERS}`, { headers: auth(token), data: { ...data, notes } });

  expect(response.status(), await response.text()).toBe(201);

  // El buscador de ordenes mira el codigo y el articulo, no las notas: se filtra por proveedor,
  // que si acota, y la recien creada es la primera por codigo.
  const { orders } = await (
    await request.get(`${baseUrl}${ORDERS}?supplierId=${data.supplierId}`, { headers: auth(token) })
  ).json();

  return orders.find((order: { notes: string }) => order.notes === notes);
}

export async function aDraftReceipt(
  request: APIRequestContext,
  token: string,
  orderId: string,
  lines: { orderLineId: string; quantity: number }[],
  baseUrl = '',
  extra: { date?: string; exchangeRate?: number } = {},
) {
  const notes = `e2e ${unique()}`;
  const response = await request.post(`${baseUrl}${RECEIPTS}`, { headers: auth(token), data: { orderId, notes, lines, ...extra } });

  expect(response.status(), await response.text()).toBe(201);

  const { receipts } = await (
    await request.get(`${baseUrl}${RECEIPTS}?orderId=${orderId}`, { headers: auth(token) })
  ).json();

  return receipts.find((receipt: { notes: string }) => receipt.notes === notes);
}
