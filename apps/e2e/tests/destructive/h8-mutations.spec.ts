import { expect, test } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { ACME_INVENTORY, auth, tokenFor } from '../../support/inventory-fixtures.js';
import { seedDemoData } from '../../support/infrastructure.js';
import { PAYMENTS, RECEIVABLES } from '../../support/receivables-fixtures.js';
import {
  CUSTOMERS,
  DISPATCHES,
  INVOICES,
  SALES_ORDERS,
  aDraftDispatch,
  aDraftSalesOrder,
  aFreshCustomer,
  aStockedItem,
} from '../../support/sales-fixtures.js';

const CREDIT_NOTES = '/api/v1/receivables/credit-notes';
const SALES_RETURNS = '/api/v1/sales/returns';

const error = async (response: APIResponse) => {
  const json = await response.json();
  return [response.status(), json.error];
};

async function createCreditPayment(
  request: APIRequestContext,
  token: string,
  data: { customerId: string; creditSourceId: string; reference: string; allocations: { invoiceId: string; amount: number }[] },
) {
  const res = await request.post(PAYMENTS, {
    headers: auth(token),
    data: {
      customerId: data.customerId,
      method: 'credit_note',
      creditSourceId: data.creditSourceId,
      reference: data.reference,
      allocations: data.allocations,
    },
  });
  expect(res.status(), await res.text()).toBe(201);

  const { payments } = await (
    await request.get(`${PAYMENTS}?q=${encodeURIComponent(data.reference)}`, { headers: auth(token) })
  ).json();

  return payments.find((p: { reference: string }) => p.reference === data.reference) as { id: string; code: string; amount: number };
}

test.describe.configure({ mode: 'serial' });

test.describe('destructive H8 credit note and return mutations', () => {
  // Cada ejecucion garantiza su estado inicial y restaura al terminar.
  test.beforeAll(async () => {
    seedDemoData();
  });

  test.afterAll(async () => {
    seedDemoData();
  });

  test('blocks cancelling an invoice that has confirmed sales returns', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    // FAC000002 de Corner Store tiene la devolucion confirmada DVV000001
    const { invoices } = await (await request.get(`${INVOICES}?q=FAC000002`, { headers: auth(token) })).json();
    const invoice = invoices.find((inv: { code: string }) => inv.code === 'FAC000002');
    expect(invoice).toBeDefined();

    const response = await request.put(`${INVOICES}/${invoice.id}/cancel`, { headers: auth(token) });
    expect(await error(response)).toEqual([409, 'InvoiceWithReturnsError']);
  });

  test('enforces credit note available balance quota and updates on payment confirmation', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    // NCC000003 de Farmacia San Rafael (CLI000003) tiene 11.60 total,
    // 4.64 cobro de emision, 5.00 cobro posterior -> saldo disponible 1.96 USD
    const { creditNotes } = await (await request.get(`${CREDIT_NOTES}?text=NCC000003`, { headers: auth(token) })).json();
    const note = creditNotes.find((cn: { code: string }) => cn.code === 'NCC000003');
    expect(note).toBeDefined();
    expect(note.availableCredit).toBe(1.96);

    // FAC000006 de Farmacia San Rafael debe 1.96 USD
    const { invoices } = await (await request.get(`${INVOICES}?q=FAC000006`, { headers: auth(token) })).json();
    const invoice6 = invoices.find((inv: { code: string }) => inv.code === 'FAC000006');
    expect(invoice6).toBeDefined();

    // 1. Intentar cobrar mas credito del disponible: 1.97 USD (disponible es 1.96)
    const overPayment = await createCreditPayment(request, token, {
      customerId: note.customer.id,
      creditSourceId: note.id,
      reference: `OVER-${Date.now()}`,
      allocations: [{ invoiceId: invoice6.id, amount: 1.97 }],
    });

    const overConfirmRes = await request.put(`${PAYMENTS}/${overPayment.id}/confirm`, { headers: auth(token) });
    expect(await error(overConfirmRes)).toEqual([409, 'CreditNoteExceededError']);

    // Cancelar el borrador fallido
    await request.put(`${PAYMENTS}/${overPayment.id}/cancel`, { headers: auth(token) });

    // 2. Cobrar dentro del disponible: 1.00 USD
    const validPayment = await createCreditPayment(request, token, {
      customerId: note.customer.id,
      creditSourceId: note.id,
      reference: `VALID-${Date.now()}`,
      allocations: [{ invoiceId: invoice6.id, amount: 1.0 }],
    });

    const validConfirmRes = await request.put(`${PAYMENTS}/${validPayment.id}/confirm`, { headers: auth(token) });
    expect(validConfirmRes.status()).toBe(200);

    // El disponible de la nota debe haber bajado de 1.96 a 0.96
    const updatedNoteRes = await (await request.get(`${CREDIT_NOTES}/${note.id}`, { headers: auth(token) })).json();
    expect(updatedNoteRes.creditNote.availableCredit).toBe(0.96);

    // 3. Anular el cobro devuelve el credito a la nota
    const cancelPaymentRes = await request.put(`${PAYMENTS}/${validPayment.id}/cancel`, { headers: auth(token) });
    expect(cancelPaymentRes.status()).toBe(200);

    const restoredNoteRes = await (await request.get(`${CREDIT_NOTES}/${note.id}`, { headers: auth(token) })).json();
    expect(restoredNoteRes.creditNote.availableCredit).toBe(1.96);
  });

  test('blocks cancelling a credit note that has confirmed payments applied', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    // NCC000003 tiene el cobro COB000005 confirmado aplicado
    const { creditNotes } = await (await request.get(`${CREDIT_NOTES}?text=NCC000003`, { headers: auth(token) })).json();
    const note = creditNotes.find((cn: { code: string }) => cn.code === 'NCC000003');
    expect(note).toBeDefined();

    const response = await request.put(`${CREDIT_NOTES}/${note.id}/cancel`, { headers: auth(token) });
    expect(await error(response)).toEqual([409, 'CreditNoteWithApplicationsError']);
  });

  test('blocks direct cancellation of the payment issued alongside a credit note', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    // NCC000001 (descuento posterior de FAC000003) creo el cobro COB000002 al emitirse
    const { creditNotes } = await (await request.get(`${CREDIT_NOTES}?text=NCC000001`, { headers: auth(token) })).json();
    const note1 = creditNotes.find((cn: { code: string }) => cn.code === 'NCC000001');
    expect(note1).toBeDefined();

    const { payments } = await (await request.get(`${PAYMENTS}?q=COB000002`, { headers: auth(token) })).json();
    const issuePayment = payments.find((p: { code: string }) => p.code === 'COB000002');
    expect(issuePayment).toBeDefined();

    const response = await request.put(`${PAYMENTS}/${issuePayment.id}/cancel`, { headers: auth(token) });
    expect(await error(response)).toEqual([409, 'IssuePaymentCannotBeCancelledDirectlyError']);
  });

  test('confirming a resalable sales return increases kardex stock, and cancelling it creates a reversal', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    // Crear cliente y articulo propio para no chocar
    const customer = await aFreshCustomer(request, token);
    const item = await aStockedItem(request, token, 10);

    // Crear orden y despacho confirmado de 2 unidades
    const order = await aDraftSalesOrder(
      request,
      token,
      {
        customerId: customer.id,
        lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 2, unitPrice: 10 }],
      },
    );
    await request.put(`${SALES_ORDERS}/${order.id}/confirm`, { headers: auth(token) });

    const { orders } = await (await request.get(`${SALES_ORDERS}?customerId=${customer.id}`, { headers: auth(token) })).json();
    const confirmedOrder = orders.find((o: { id: string }) => o.id === order.id);

    const dispatch = await aDraftDispatch(
      request,
      token,
      order.id,
      [{ orderLineId: confirmedOrder.lines[0].id, quantity: 2 }],
    );
    await request.put(`${DISPATCHES}/${dispatch.id}/confirm`, { headers: auth(token) });

    // Crear devolucion de venta en condicion apta para la venta (resalable)
    const returnRes = await request.post(SALES_RETURNS, {
      headers: auth(token),
      data: {
        customerId: customer.id,
        dispatchId: dispatch.id,
        condition: 'resalable',
        reason: 'Cliente pidio de mas',
        lines: [{ dispatchLineId: dispatch.lines[0].id, quantity: 1 }],
      },
    });
    expect(returnRes.status()).toBe(201);
    const { id: returnId } = await returnRes.json();

    // Confirmar devolucion
    const confirmRes = await request.put(`${SALES_RETURNS}/${returnId}/confirm`, { headers: auth(token) });
    expect(confirmRes.status()).toBe(200);

    // El kardex debe mostrar reingreso (direction: in) por devolucion
    const movementsAfterConfirm = (
      await (await request.get(`/api/v1/inventory/items/${item.id}/movements`, { headers: auth(token) })).json()
    ).movements;
    // El movimiento mas reciente es la devolucion
    expect(movementsAfterConfirm[0]).toMatchObject({
      direction: 'in',
      isReversal: false,
      quantity: 1,
    });

    // Anular devolucion
    const cancelRes = await request.put(`${SALES_RETURNS}/${returnId}/cancel`, { headers: auth(token) });
    expect(cancelRes.status()).toBe(200);

    // Kardex: debe mostrar la contrapartida de la devolucion (direction: out, isReversal: true)
    const movementsAfterCancel = (
      await (await request.get(`/api/v1/inventory/items/${item.id}/movements`, { headers: auth(token) })).json()
    ).movements;
    expect(movementsAfterCancel[0]).toMatchObject({
      direction: 'out',
      isReversal: true,
      quantity: 1,
    });
  });

  test('creates, confirms and cancels an originless sales return via API (H8 §4.1 rule 3)', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    // Cliente y articulo propio
    const customer = await aFreshCustomer(request, token);
    const item = await aStockedItem(request, token, 10);

    // Crear devolucion de venta sin despacho de origen con costo manual escrito
    const returnRes = await request.post(SALES_RETURNS, {
      headers: auth(token),
      data: {
        customerId: customer.id,
        dispatchId: null,
        warehouseId: ACME_INVENTORY.mainWarehouse,
        condition: 'resalable',
        reason: 'Devolucion sin despacho previo',
        lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 3, unitCost: 4.5 }],
      },
    });
    expect(returnRes.status()).toBe(201);
    const { id: returnId } = await returnRes.json();

    // Confirmar la devolucion sin despacho
    const confirmRes = await request.put(`${SALES_RETURNS}/${returnId}/confirm`, { headers: auth(token) });
    expect(confirmRes.status()).toBe(200);

    // Kardex: debe reflejar entrada por la devolucion con el costo unitario escrito (4.5)
    const movementsAfterConfirm = (
      await (await request.get(`/api/v1/inventory/items/${item.id}/movements`, { headers: auth(token) })).json()
    ).movements;
    expect(movementsAfterConfirm[0]).toMatchObject({
      direction: 'in',
      isReversal: false,
      quantity: 3,
      unitCost: 4.5,
    });

    // Anular la devolucion sin despacho
    const cancelRes = await request.put(`${SALES_RETURNS}/${returnId}/cancel`, { headers: auth(token) });
    expect(cancelRes.status()).toBe(200);

    // Kardex: reversion de salida
    const movementsAfterCancel = (
      await (await request.get(`/api/v1/inventory/items/${item.id}/movements`, { headers: auth(token) })).json()
    ).movements;
    expect(movementsAfterCancel[0]).toMatchObject({
      direction: 'out',
      isReversal: true,
      quantity: 3,
    });
  });
});
