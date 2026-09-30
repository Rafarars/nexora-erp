import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACME_INVENTORY, aFreshItem, auth } from './inventory-fixtures.js';

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

export async function aConfirmedPurchaseInvoice(
  request: APIRequestContext,
  token: string,
  supplierId: string,
  subtotal: number,
  date = '2026-09-08',
  baseUrl = '',
) {
  const invoiceNumber = `FAC-E2E-${unique()}`;
  const response = await request.post(`${baseUrl}/api/v1/purchasing/invoices`, {
    headers: auth(token),
    data: {
      supplierId,
      supplierInvoiceNumber: invoiceNumber,
      issueDate: date,
      dueDate: date,
      lines: [
        {
          concept: 'Gasto operativo e2e',
          quantity: 1,
          unitPrice: subtotal,
          taxRate: 0,
        },
      ],
    },
  });

  expect(response.status(), await response.text()).toBe(201);
  const { id, code } = await response.json();

  const confirmRes = await request.put(`${baseUrl}/api/v1/purchasing/invoices/${id}/confirm`, {
    headers: auth(token),
  });
  expect(confirmRes.status(), await confirmRes.text()).toBe(200);

  const getRes = await request.get(`${baseUrl}/api/v1/purchasing/invoices/${id}`, {
    headers: auth(token),
  });
  const invoiceData = await getRes.json();
  const lines = invoiceData.invoice?.lines ?? [];

  return { id, code, invoiceNumber, subtotal, lines };
}

export async function aConfirmedMerchandiseInvoice(
  request: APIRequestContext,
  token: string,
  supplierId: string,
  unitCost = 10,
  quantity = 10,
  baseUrl = '',
) {
  const item = await aFreshItem(request, token, baseUrl);
  const order = await aDraftOrder(
    request,
    token,
    {
      supplierId,
      warehouseId: ACME_INVENTORY.mainWarehouse,
      lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity, unitCost }],
    },
    baseUrl,
  );
  await request.put(`${baseUrl}/api/v1/purchasing/orders/${order.id}/confirm`, {
    headers: auth(token),
  });

  const receipt = await aDraftReceipt(
    request,
    token,
    order.id,
    [{ orderLineId: order.lines[0].id, quantity }],
    baseUrl,
  );
  await request.put(`${baseUrl}/api/v1/purchasing/receipts/${receipt.id}/confirm`, {
    headers: auth(token),
  });

  const invoiceNumber = `FAC-MERC-${unique()}`;
  const invRes = await request.post(`${baseUrl}/api/v1/purchasing/invoices`, {
    headers: auth(token),
    data: {
      supplierId,
      supplierInvoiceNumber: invoiceNumber,
      issueDate: '2026-09-08',
      dueDate: '2026-09-08',
      lines: [
        {
          receiptLineId: receipt.lines[0].id,
          orderLineId: order.lines[0].id,
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          unitId: ACME_INVENTORY.piece,
          quantity,
          unitPrice: unitCost,
          taxRate: 0,
        },
      ],
    },
  });
  expect(invRes.status(), await invRes.text()).toBe(201);
  const { id, code } = await invRes.json();

  const confirmRes = await request.put(`${baseUrl}/api/v1/purchasing/invoices/${id}/confirm`, {
    headers: auth(token),
  });
  expect(confirmRes.status(), await confirmRes.text()).toBe(200);

  const getRes = await request.get(`${baseUrl}/api/v1/purchasing/invoices/${id}`, {
    headers: auth(token),
  });
  const invoiceData = await getRes.json();
  const lines = invoiceData.invoice?.lines ?? [];

  return {
    id,
    code,
    invoiceNumber,
    subtotal: unitCost * quantity,
    lines,
    item,
    receiptId: receipt.id,
    receiptLineId: receipt.lines[0].id,
  };
}

export async function aConfirmedPurchaseReturnForReceipt(
  request: APIRequestContext,
  token: string,
  supplierId: string,
  receiptId: string,
  receiptLineId: string,
  quantity = 1,
  baseUrl = '',
) {
  const returnRes = await request.post(`${baseUrl}/api/v1/purchasing/returns`, {
    headers: auth(token),
    data: {
      supplierId,
      receiptId,
      reason: 'Devolución e2e para nota de crédito',
      lines: [{ receiptLineId, quantity }],
    },
  });
  expect(returnRes.status(), await returnRes.text()).toBe(201);
  const { id } = await returnRes.json();

  const confirmRes = await request.put(`${baseUrl}/api/v1/purchasing/returns/${id}/confirm`, {
    headers: auth(token),
  });
  expect(confirmRes.status(), await confirmRes.text()).toBe(200);

  const getRes = await request.get(`${baseUrl}/api/v1/purchasing/returns?receiptId=${receiptId}`, {
    headers: auth(token),
  });
  const data = await getRes.json();
  const ret = data.returns.find((r: { id: string }) => r.id === id);
  return ret;
}


