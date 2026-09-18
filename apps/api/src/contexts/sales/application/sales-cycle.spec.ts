import { describe, expect, it } from 'vitest';
import {
  DispatchAlreadyInvoicedError,
  DispatchExceedsPendingError,
  DispatchInvoicedError,
  DispatchNotEditableError,
  DispatchNotInvoiceableError,
  InactiveCustomerError,
  InactiveSalesItemError,
  InsufficientAvailabilityError,
  InsufficientStockForDispatchError,
  SalesItemChangedError,
  SalesOrderNotDispatchableError,
  SalesOrderNotEditableError,
  SalesOrderNotFoundError,
  SalesOrderWithDispatchesError,
  SalesWarehouseNotFoundError,
  ItemNotSellableError,
  ServiceNotSellableError,
} from '../domain/errors/sales.errors.js';
import { BOX, FOREIGN_WAREHOUSE, KILO, MAIN, NORTH, PIECE, SERVICE, SOAP, TENANT_A, TENANT_B, WATER, NOT_TRADED_ITEM } from '../domain/testing/sales.mother.js';
import { SalesOrderCreatorRequest } from './create-order/sales-order-creator.js';
import { SalesScenario, aSalesScenario } from './testing/sales-scenario.js';

// El ciclo de venta junto: pedir, reservar, despachar en partes, facturar, anular y ver como el
// pedido, la reserva y la existencia retroceden.
async function world(stock: { water?: number; soap?: number } = { water: 480, soap: 50 }) {
  const s = aSalesScenario();
  await s.createCustomer.run({ tenantId: TENANT_A, name: 'Comercial Delta', paymentTermDays: 15 });
  const [customer] = (await s.searchCustomers.run({ tenantId: TENANT_A })).customers;
  s.store.stock(TENANT_A, WATER, MAIN, stock.water ?? 0);
  s.store.stock(TENANT_A, SOAP, MAIN, stock.soap ?? 0);

  return { s, customerId: customer.id };
}

function orderRequest(customerId: string, overrides: Partial<SalesOrderCreatorRequest> = {}): SalesOrderCreatorRequest {
  return {
    tenantId: TENANT_A,
    customerId,
    warehouseId: MAIN,
    notes: 'Pedido semanal',
    lines: [
      { itemId: WATER, unitId: BOX, quantity: 10, unitPrice: 30 },
      { itemId: SOAP, unitId: KILO, quantity: 5, unitPrice: 4 },
    ],
    ...overrides,
  };
}

const latestOrder = async (s: SalesScenario, tenantId = TENANT_A) => (await s.searchOrders.run({ tenantId })).orders[0];
const latestDispatch = async (s: SalesScenario) => (await s.searchDispatches.run({ tenantId: TENANT_A })).dispatches[0];
const latestInvoice = async (s: SalesScenario) => (await s.searchInvoices.run({ tenantId: TENANT_A })).invoices[0];
const availabilityOf = async (s: SalesScenario, itemId = WATER) =>
  (await s.searchAvailability.run({ tenantId: TENANT_A })).availability.find((row) => row.item.id === itemId);

async function confirmedOrder(overrides: Partial<SalesOrderCreatorRequest> = {}, stock?: { water?: number; soap?: number }) {
  const w = await world(stock);
  await w.s.createOrder.run(orderRequest(w.customerId, overrides));
  const order = await latestOrder(w.s);
  await w.s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });

  return { ...w, order: await latestOrder(w.s) };
}

async function dispatch(s: SalesScenario, orderId: string, lines: { orderLineId: string; quantity: number }[]) {
  await s.createDispatch.run({ tenantId: TENANT_A, orderId, lines });
  const created = await latestDispatch(s);
  await s.confirmDispatch.run({ tenantId: TENANT_A, dispatchId: created.id });

  return created.id;
}

describe('sales orders', () => {
  it('creates a draft with its code, base quantities, the tax of each item and totals, reserving nothing', async () => {
    const { s, customerId } = await world();

    await s.createOrder.run(orderRequest(customerId));

    expect(await latestOrder(s)).toMatchObject({
      code: 'PED000001',
      status: 'draft',
      customer: { id: customerId, name: 'Comercial Delta' },
      totals: { subtotal: 320, tax: 48, total: 368 },
      lines: [{ sku: 'AGUA-500', quantity: 10, baseQuantity: 240, taxRate: 16, pendingQuantity: 10 }, { sku: 'JABON', taxRate: 0 }],
    });
    expect(await availabilityOf(s)).toMatchObject({ onHand: 480, reserved: 0, available: 480 });
  });

  it.each([
    ['an inactive customer', async (s: SalesScenario, customerId: string) => {
      await s.changeCustomerStatus.run({ tenantId: TENANT_A, customerId, active: false });
      return {};
    }, InactiveCustomerError],
    ['a service', async () => ({ lines: [{ itemId: SERVICE, unitId: PIECE, quantity: 1, unitPrice: 1 }] }), ServiceNotSellableError],
    ['an item that is not sold', async () => ({ lines: [{ itemId: NOT_TRADED_ITEM, unitId: PIECE, quantity: 1, unitPrice: 1 }] }), ItemNotSellableError],
    ['a warehouse of another tenant', async () => ({ warehouseId: FOREIGN_WAREHOUSE }), SalesWarehouseNotFoundError],
  ] as const)('refuses an order with %s', async (_case, arrange, error) => {
    const { s, customerId } = await world();

    await expect(s.createOrder.run(orderRequest(customerId, await arrange(s, customerId)))).rejects.toThrow(error);
  });

  it('confirming reserves the stock: available goes down, on hand does not', async () => {
    const { s } = await confirmedOrder();

    expect((await latestOrder(s)).status).toBe('confirmed');
    expect(await availabilityOf(s)).toMatchObject({ onHand: 480, reserved: 240, available: 240 });
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(480);
  });

  // La regla central del pedido: no se reserva mas de lo disponible.
  it('refuses to confirm an order that does not fit in what the other orders left available', async () => {
    const { s, customerId } = await confirmedOrder({}, { water: 300, soap: 50 });
    await s.createOrder.run(orderRequest(customerId, { lines: [{ itemId: WATER, unitId: PIECE, quantity: 61, unitPrice: 1 }] }));
    const second = await latestOrder(s);

    await expect(s.confirmOrder.run({ tenantId: TENANT_A, orderId: second.id })).rejects.toThrow(InsufficientAvailabilityError);
    expect((await latestOrder(s)).status).toBe('draft');

    await s.updateOrder.run({ ...orderRequest(customerId, { lines: [{ itemId: WATER, unitId: PIECE, quantity: 60, unitPrice: 1 }] }), orderId: second.id });
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: second.id });
    expect(await availabilityOf(s)).toMatchObject({ reserved: 300, available: 0 });
  });

  it('cancelling a confirmed order releases its reservation', async () => {
    const { s, order } = await confirmedOrder();

    await s.cancelOrder.run({ tenantId: TENANT_A, orderId: order.id });

    expect(await availabilityOf(s)).toMatchObject({ reserved: 0, available: 480 });
  });

  it('keeps the identity of every line and refuses to edit once confirmed', async () => {
    const { s, customerId } = await world();
    await s.createOrder.run(orderRequest(customerId));
    const draft = await latestOrder(s);
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: draft.id });

    expect((await latestOrder(s)).lines.map((line) => line.id)).toEqual(draft.lines.map((line) => line.id));
    await expect(s.updateOrder.run({ ...orderRequest(customerId), orderId: draft.id })).rejects.toThrow(SalesOrderNotEditableError);
  });

  // 10 cajas pedidas cuando traian 24 no se reservan como 120 en silencio: se revisa y se guarda.
  it('refuses to confirm a draft whose box changed until the draft is saved again', async () => {
    const { s, customerId } = await world();
    await s.createOrder.run(orderRequest(customerId));
    const { id } = await latestOrder(s);
    s.catalog.items.find((item) => item.id === WATER)!.units.find((unit) => unit.unitId === BOX)!.conversionFactor = 12;

    await expect(s.confirmOrder.run({ tenantId: TENANT_A, orderId: id })).rejects.toThrow(SalesItemChangedError);
    expect((await latestOrder(s)).status).toBe('draft');

    await s.updateOrder.run({ ...orderRequest(customerId), orderId: id });
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: id });

    expect(await latestOrder(s)).toMatchObject({ status: 'confirmed', lines: [{ quantity: 10, baseQuantity: 120 }, {}] });
  });

  it('refuses to confirm a draft whose item was deactivated after it was written', async () => {
    const { s, customerId } = await world();
    await s.createOrder.run(orderRequest(customerId));
    s.catalog.items.find((item) => item.id === SOAP)!.isActive = false;

    await expect(s.confirmOrder.run({ tenantId: TENANT_A, orderId: (await latestOrder(s)).id })).rejects.toThrow(InactiveSalesItemError);
  });

  it('cannot reach an order of another tenant', async () => {
    const { s, order } = await confirmedOrder();

    await expect(s.cancelOrder.run({ tenantId: TENANT_B, orderId: order.id })).rejects.toThrow(SalesOrderNotFoundError);
    expect((await s.searchOrders.run({ tenantId: TENANT_B })).orders).toEqual([]);
  });
});

describe('dispatches', () => {
  it('a partial dispatch lowers the stock and the reservation, and leaves the rest reserved', async () => {
    const { s, order } = await confirmedOrder();

    await dispatch(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 4 }]);

    expect(await latestDispatch(s)).toMatchObject({ code: 'DES000001', status: 'confirmed', order: { code: 'PED000001' }, invoice: null, lines: [{ quantity: 4, baseQuantity: 96 }] });
    expect(await latestOrder(s)).toMatchObject({ status: 'partially_dispatched', lines: [{ dispatchedQuantity: 4, pendingQuantity: 6 }, {}] });
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(384);
    expect(await availabilityOf(s)).toMatchObject({ onHand: 384, reserved: 144, available: 240 });
  });

  it('completes the order and then refuses to dispatch more', async () => {
    const { s, order } = await confirmedOrder();

    await dispatch(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 10 }, { orderLineId: order.lines[1].id, quantity: 5 }]);

    expect((await latestOrder(s)).status).toBe('dispatched');
    await expect(s.createDispatch.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 1 }] })).rejects.toThrow(
      SalesOrderNotDispatchableError,
    );
  });

  it('refuses to dispatch more than is pending, already when writing the draft', async () => {
    const { s, order } = await confirmedOrder();

    await expect(s.createDispatch.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 11 }] })).rejects.toThrow(
      DispatchExceedsPendingError,
    );
  });

  it('refuses to dispatch what someone else took out of the warehouse, and changes nothing', async () => {
    const { s, order } = await confirmedOrder();
    s.store.withdraw(TENANT_A, WATER, MAIN, 400);
    await s.createDispatch.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 10 }] });

    await expect(s.confirmDispatch.run({ tenantId: TENANT_A, dispatchId: (await latestDispatch(s)).id })).rejects.toThrow(InsufficientStockForDispatchError);
    expect((await latestOrder(s)).status).toBe('confirmed');
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(80);
  });

  it('refuses to cancel an order that already dispatched goods', async () => {
    const { s, order } = await confirmedOrder();
    await dispatch(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 1 }]);

    await expect(s.cancelOrder.run({ tenantId: TENANT_A, orderId: order.id })).rejects.toThrow(SalesOrderWithDispatchesError);
  });

  it('cancelling a dispatch brings the stock and the reservation back', async () => {
    const { s, order } = await confirmedOrder();
    const id = await dispatch(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 10 }]);

    await s.cancelDispatch.run({ tenantId: TENANT_A, dispatchId: id });

    expect((await latestOrder(s)).status).toBe('confirmed');
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(480);
    expect(await availabilityOf(s)).toMatchObject({ reserved: 240 });
  });

  it('edits a draft dispatch and not a confirmed one', async () => {
    const { s, order } = await confirmedOrder();
    await s.createDispatch.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 1 }] });
    const { id } = await latestDispatch(s);

    await s.updateDispatch.run({ tenantId: TENANT_A, dispatchId: id, notes: 'Solo jabón', lines: [{ orderLineId: order.lines[1].id, quantity: 2 }] });
    expect(await latestDispatch(s)).toMatchObject({ notes: 'Solo jabón', lines: [{ sku: 'JABON', quantity: 2 }] });

    await s.confirmDispatch.run({ tenantId: TENANT_A, dispatchId: id });
    await expect(s.updateDispatch.run({ tenantId: TENANT_A, dispatchId: id, lines: [] })).rejects.toThrow(DispatchNotEditableError);
  });
});

describe('invoices', () => {
  it('invoices what left at the order price, falls due after the payment term and does not touch the stock', async () => {
    const { s, order } = await confirmedOrder();
    const id = await dispatch(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 4 }]);

    await s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: id });

    expect(await latestInvoice(s)).toMatchObject({
      code: 'FAC000001',
      status: 'issued',
      customer: { name: 'Comercial Delta' },
      dispatch: { code: 'DES000001' },
      order: { code: 'PED000001' },
      issueDate: '2026-01-15',
      dueDate: '2026-01-30',
      subtotal: 120,
      tax: 19.2,
      total: 139.2,
      lines: [{ sku: 'AGUA-500', unitAbbreviation: 'cja', quantity: 4, unitPrice: 30, subtotal: 120 }],
    });
    expect((await latestDispatch(s)).invoice).toMatchObject({ code: 'FAC000001' });
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(384);
  });

  it('invoices a dispatch only once, and only a confirmed one', async () => {
    const { s, order } = await confirmedOrder();
    const id = await dispatch(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 1 }]);
    await s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: id });
    await s.createDispatch.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 1 }] });

    await expect(s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: id })).rejects.toThrow(DispatchAlreadyInvoicedError);
    await expect(s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: (await latestDispatch(s)).id })).rejects.toThrow(DispatchNotInvoiceableError);
  });

  it('an invoiced dispatch cannot be cancelled until its invoice is', async () => {
    const { s, order } = await confirmedOrder();
    const id = await dispatch(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 2 }]);
    await s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: id });

    await expect(s.cancelDispatch.run({ tenantId: TENANT_A, dispatchId: id })).rejects.toThrow(DispatchInvoicedError);

    await s.cancelInvoice.run({ tenantId: TENANT_A, invoiceId: (await latestInvoice(s)).id });
    expect((await latestInvoice(s)).status).toBe('cancelled');
    expect((await latestDispatch(s)).invoice).toBeNull();

    await s.cancelDispatch.run({ tenantId: TENANT_A, dispatchId: id });
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(480);
  });

  it('filters the availability by warehouse and answers not found for a warehouse of another tenant', async () => {
    const { s } = await confirmedOrder();

    expect((await s.searchAvailability.run({ tenantId: TENANT_A, warehouseId: NORTH })).availability).toEqual([]);
    await expect(s.searchAvailability.run({ tenantId: TENANT_A, warehouseId: FOREIGN_WAREHOUSE })).rejects.toThrow(SalesWarehouseNotFoundError);
  });
});
