import { describe, expect, it } from 'vitest';
import {
  GoodsReceiptNotEditableError,
  InactivePurchaseItemError,
  InactiveSupplierError,
  PurchaseItemChangedError,
  PurchaseItemNotFoundError,
  PurchaseOrderNotEditableError,
  PurchaseOrderNotFoundError,
  PurchaseOrderNotReceivableError,
  PurchaseOrderWithReceiptsError,
  PurchaseWarehouseNotFoundError,
  InactivePurchaseWarehouseError,
  ReceiptExceedsPendingError,
  ReceivedGoodsAlreadyUsedError,
  ItemNotPurchasableError,
  ServiceNotPurchasableError,
} from '../domain/errors/purchasing.errors.js';
import { BOX, CLOSED, FOREIGN_ITEM, FOREIGN_WAREHOUSE, MAIN, NORTH, PIECE, SERVICE, SOAP, KILO, TENANT_A, TENANT_B, WATER, NOT_TRADED_ITEM } from '../domain/testing/purchasing.mother.js';
import { PurchaseOrderCreatorRequest } from './create-order/purchase-order-creator.js';
import { PurchasingScenario, aPurchasingScenario } from './testing/purchasing-scenario.js';

// El ciclo de compra junto, porque su valor esta en como se encadena: pedir, confirmar,
// recibir en partes, anular una entrada y ver como la orden y la existencia retroceden.
async function world() {
  const s = aPurchasingScenario();
  await s.createSupplier.run({ tenantId: TENANT_A, name: 'Distribuidora Andina' });
  const [supplier] = (await s.searchSuppliers.run({ tenantId: TENANT_A })).suppliers;

  return { s, supplierId: supplier.id };
}

function orderRequest(supplierId: string, overrides: Partial<PurchaseOrderCreatorRequest> = {}): PurchaseOrderCreatorRequest {
  return {
    tenantId: TENANT_A,
    supplierId,
    warehouseId: MAIN,
    expectedDate: '2026-01-20',
    notes: 'Reposicion mensual',
    lines: [
      { itemId: WATER, unitId: BOX, quantity: 10, unitCost: 12 },
      { itemId: SOAP, unitId: KILO, quantity: 5, unitCost: 3.2 },
    ],
    ...overrides,
  };
}

async function latestOrder(s: PurchasingScenario, tenantId = TENANT_A) {
  return (await s.searchOrders.run({ tenantId })).orders[0];
}

async function latestReceipt(s: PurchasingScenario) {
  return (await s.searchReceipts.run({ tenantId: TENANT_A })).receipts[0];
}

async function confirmedOrder(overrides: Partial<PurchaseOrderCreatorRequest> = {}) {
  const w = await world();
  await w.s.createOrder.run(orderRequest(w.supplierId, overrides));
  const order = await latestOrder(w.s);
  await w.s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });

  return { ...w, order: await latestOrder(w.s) };
}

async function receive(s: PurchasingScenario, orderId: string, lines: { orderLineId: string; quantity: number }[]) {
  await s.createReceipt.run({ tenantId: TENANT_A, orderId, lines });
  const receipt = await latestReceipt(s);
  await s.confirmReceipt.run({ tenantId: TENANT_A, receiptId: receipt.id });

  return receipt.id;
}

describe('purchase orders', () => {
  it('creates a draft with its code, base quantities, the tax of each item and totals', async () => {
    const { s, supplierId } = await world();

    await s.createOrder.run(orderRequest(supplierId));

    expect(await latestOrder(s)).toMatchObject({
      code: 'OC000001',
      status: 'draft',
      supplier: { id: supplierId, name: 'Distribuidora Andina' },
      warehouse: { id: MAIN, name: 'Principal' },
      date: '2026-01-15',
      expectedDate: '2026-01-20',
      totals: { subtotal: 136, tax: 19.2, total: 155.2 },
      lines: [
        { sku: 'AGUA-500', unitAbbreviation: 'cja', quantity: 10, baseQuantity: 240, taxRate: 16, receivedQuantity: 0, pendingQuantity: 10, subtotal: 120 },
        { sku: 'JABON', unitAbbreviation: 'kg', quantity: 5, baseQuantity: 5, taxRate: 0, subtotal: 16 },
      ],
    });
  });

  it.each([
    ['an inactive supplier', async (s: PurchasingScenario, supplierId: string) => {
      await s.changeSupplierStatus.run({ tenantId: TENANT_A, supplierId, active: false });
      return {};
    }, InactiveSupplierError],
    ['an inactive warehouse', async () => ({ warehouseId: CLOSED }), InactivePurchaseWarehouseError],
    ['a warehouse of another tenant', async () => ({ warehouseId: FOREIGN_WAREHOUSE }), PurchaseWarehouseNotFoundError],
    ['an item of another tenant', async () => ({ lines: [{ itemId: FOREIGN_ITEM, unitId: PIECE, quantity: 1, unitCost: 1 }] }), PurchaseItemNotFoundError],
    ['a service', async () => ({ lines: [{ itemId: SERVICE, unitId: PIECE, quantity: 1, unitCost: 1 }] }), ServiceNotPurchasableError],
    ['an item that is not bought', async () => ({ lines: [{ itemId: NOT_TRADED_ITEM, unitId: PIECE, quantity: 1, unitCost: 1 }] }), ItemNotPurchasableError],
  ] as const)('refuses an order with %s', async (_case, arrange, error) => {
    const { s, supplierId } = await world();
    const overrides = await arrange(s, supplierId);

    await expect(s.createOrder.run(orderRequest(supplierId, overrides))).rejects.toThrow(error);
  });

  it('replaces the whole draft on edit, and not once it is confirmed', async () => {
    const { s, supplierId } = await world();
    await s.createOrder.run(orderRequest(supplierId));
    const { id } = await latestOrder(s);

    await s.updateOrder.run({ ...orderRequest(supplierId, { warehouseId: NORTH, lines: [{ itemId: WATER, unitId: PIECE, quantity: 6, unitCost: 0.6 }] }), orderId: id });
    expect(await latestOrder(s)).toMatchObject({ warehouse: { id: NORTH }, lines: [{ quantity: 6 }], totals: { subtotal: 3.6 } });

    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: id });
    await expect(s.updateOrder.run({ ...orderRequest(supplierId), orderId: id })).rejects.toThrow(PurchaseOrderNotEditableError);
  });

  it('refuses to confirm a draft whose item was deactivated after it was written', async () => {
    const { s, supplierId } = await world();
    await s.createOrder.run(orderRequest(supplierId));
    s.catalog.items.find((item) => item.id === SOAP)!.isActive = false;

    await expect(s.confirmOrder.run({ tenantId: TENANT_A, orderId: (await latestOrder(s)).id })).rejects.toThrow(InactivePurchaseItemError);
    expect((await latestOrder(s)).status).toBe('draft');
  });

  // 10 cajas pedidas cuando traian 24 no se anuncian como 120 en silencio: se revisa y se guarda.
  it('refuses to confirm a draft whose box changed until the draft is saved again', async () => {
    const { s, supplierId } = await world();
    await s.createOrder.run(orderRequest(supplierId));
    const { id } = await latestOrder(s);
    s.catalog.items.find((item) => item.id === WATER)!.units.find((unit) => unit.unitId === BOX)!.conversionFactor = 12;

    await expect(s.confirmOrder.run({ tenantId: TENANT_A, orderId: id })).rejects.toThrow(PurchaseItemChangedError);
    expect(await latestOrder(s)).toMatchObject({ status: 'draft', lines: [{ baseQuantity: 240 }, {}] });

    await s.updateOrder.run({ ...orderRequest(supplierId), orderId: id });
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: id });

    expect(await latestOrder(s)).toMatchObject({ status: 'confirmed', lines: [{ quantity: 10, baseQuantity: 120 }, {}] });
  });

  // Un cliente que leyo el borrador recibe por esos identificadores despues de confirmar.
  it('keeps the identity of every line when confirming', async () => {
    const { s, supplierId } = await world();
    await s.createOrder.run(orderRequest(supplierId));
    const draft = await latestOrder(s);

    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: draft.id });

    expect((await latestOrder(s)).lines.map((line) => line.id)).toEqual(draft.lines.map((line) => line.id));
    await expect(receive(s, draft.id, [{ orderLineId: draft.lines[0].id, quantity: 1 }])).resolves.toBeDefined();
  });

  it('cannot reach an order of another tenant', async () => {
    const { s, order } = await confirmedOrder();

    await expect(s.cancelOrder.run({ tenantId: TENANT_B, orderId: order.id })).rejects.toThrow(PurchaseOrderNotFoundError);
    await expect(s.createReceipt.run({ tenantId: TENANT_B, orderId: order.id, lines: [] })).rejects.toThrow(PurchaseOrderNotFoundError);
    expect((await s.searchOrders.run({ tenantId: TENANT_B })).orders).toEqual([]);
  });
});

describe('stock in transit', () => {
  it('is announced only by confirmed orders, in base units and per warehouse', async () => {
    const { s, supplierId, order } = await confirmedOrder();
    await s.createOrder.run(orderRequest(supplierId, { lines: [{ itemId: WATER, unitId: PIECE, quantity: 7, unitCost: 1 }] }));

    const { incoming } = await s.searchIncoming.run({ tenantId: TENANT_A });

    expect(incoming).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({ sku: 'AGUA-500', baseUnit: 'un' }),
        warehouse: { id: MAIN, name: 'Principal' },
        quantity: 240,
        orders: [{ id: order.id, code: order.code, expectedDate: '2026-01-20', pendingQuantity: 240 }],
      }),
      expect.objectContaining({ item: expect.objectContaining({ sku: 'JABON' }), quantity: 5 }),
    ]);
  });

  it('shrinks as goods arrive and disappears when the order is complete or cancelled', async () => {
    const { s, order } = await confirmedOrder();

    await receive(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 4 }]);
    expect((await s.searchIncoming.run({ tenantId: TENANT_A })).incoming.find((row) => row.item.id === WATER)?.quantity).toBe(144);

    await receive(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 6 }, { orderLineId: order.lines[1].id, quantity: 5 }]);
    expect((await s.searchIncoming.run({ tenantId: TENANT_A })).incoming).toEqual([]);

    const other = await confirmedOrder();
    await other.s.cancelOrder.run({ tenantId: TENANT_A, orderId: other.order.id });
    expect((await other.s.searchIncoming.run({ tenantId: TENANT_A })).incoming).toEqual([]);
  });

  it('filters by warehouse and answers not found for a warehouse of another tenant', async () => {
    const { s } = await confirmedOrder();

    expect((await s.searchIncoming.run({ tenantId: TENANT_A, warehouseId: NORTH })).incoming).toEqual([]);
    await expect(s.searchIncoming.run({ tenantId: TENANT_A, warehouseId: FOREIGN_WAREHOUSE })).rejects.toThrow(PurchaseWarehouseNotFoundError);
  });
});

describe('goods receipts', () => {
  it('receives part of an order: the order advances and the stock goes up in base units', async () => {
    const { s, order } = await confirmedOrder();

    await receive(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 4 }]);

    expect(await latestReceipt(s)).toMatchObject({
      code: 'ENT000001',
      status: 'confirmed',
      order: { id: order.id, code: 'OC000001' },
      supplier: { name: 'Distribuidora Andina' },
      warehouse: { id: MAIN },
      lines: [{ sku: 'AGUA-500', unitAbbreviation: 'cja', quantity: 4, baseQuantity: 96, unitCost: 12 }],
    });
    expect(await latestOrder(s)).toMatchObject({ status: 'partially_received', lines: [{ receivedQuantity: 4, pendingQuantity: 6 }, { receivedQuantity: 0 }] });
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(96);
  });

  it('completes the order when everything arrived', async () => {
    const { s, order } = await confirmedOrder();

    await receive(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 10 }, { orderLineId: order.lines[1].id, quantity: 5 }]);

    expect((await latestOrder(s)).status).toBe('received');
    await expect(s.createReceipt.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 1 }] })).rejects.toThrow(
      PurchaseOrderNotReceivableError,
    );
  });

  it('refuses to receive more than is pending, already when writing the draft', async () => {
    const { s, order } = await confirmedOrder();

    await expect(
      s.createReceipt.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 10.5 }] }),
    ).rejects.toThrow(ReceiptExceedsPendingError);
  });

  // Dos borradores validos por separado que juntos se pasan: el segundo no se confirma.
  it('refuses to confirm a draft that other receipts made exceed what is pending', async () => {
    const { s, order } = await confirmedOrder();
    await s.createReceipt.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 6 }] });
    const first = await latestReceipt(s);
    await s.createReceipt.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 6 }] });
    const second = await latestReceipt(s);

    await s.confirmReceipt.run({ tenantId: TENANT_A, receiptId: first.id });

    await expect(s.confirmReceipt.run({ tenantId: TENANT_A, receiptId: second.id })).rejects.toThrow(ReceiptExceedsPendingError);
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(144);
  });

  it('does not receive into a draft or a cancelled order', async () => {
    const { s, supplierId } = await world();
    await s.createOrder.run(orderRequest(supplierId));
    const draft = await latestOrder(s);

    await expect(s.createReceipt.run({ tenantId: TENANT_A, orderId: draft.id, lines: [{ orderLineId: draft.lines[0].id, quantity: 1 }] })).rejects.toThrow(
      PurchaseOrderNotReceivableError,
    );
  });

  it('refuses to cancel an order that already received goods', async () => {
    const { s, order } = await confirmedOrder();
    await receive(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 1 }]);

    await expect(s.cancelOrder.run({ tenantId: TENANT_A, orderId: order.id })).rejects.toThrow(PurchaseOrderWithReceiptsError);
  });

  it('cancelling a receipt brings the order back to its previous status and takes the stock out', async () => {
    const { s, order } = await confirmedOrder();
    const first = await receive(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 4 }]);
    const second = await receive(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 6 }, { orderLineId: order.lines[1].id, quantity: 5 }]);
    expect((await latestOrder(s)).status).toBe('received');

    await s.cancelReceipt.run({ tenantId: TENANT_A, receiptId: second });
    expect(await latestOrder(s)).toMatchObject({ status: 'partially_received', lines: [{ receivedQuantity: 4 }, { receivedQuantity: 0 }] });
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(96);

    await s.cancelReceipt.run({ tenantId: TENANT_A, receiptId: first });
    expect((await latestOrder(s)).status).toBe('confirmed');
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(0);

    // Sin entradas vivas, la orden vuelve a poder anularse.
    await s.cancelOrder.run({ tenantId: TENANT_A, orderId: order.id });
    expect((await latestOrder(s)).status).toBe('cancelled');
  });

  it('refuses to cancel a receipt whose goods already left, and changes nothing', async () => {
    const { s, order } = await confirmedOrder();
    const receipt = await receive(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 4 }]);
    s.store.withdraw(TENANT_A, WATER, MAIN, 50);

    await expect(s.cancelReceipt.run({ tenantId: TENANT_A, receiptId: receipt })).rejects.toThrow(ReceivedGoodsAlreadyUsedError);
    expect((await latestReceipt(s)).status).toBe('confirmed');
    expect((await latestOrder(s)).status).toBe('partially_received');
  });

  it('edits a draft receipt and not a confirmed one', async () => {
    const { s, order } = await confirmedOrder();
    await s.createReceipt.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 1 }] });
    const { id } = await latestReceipt(s);

    await s.updateReceipt.run({ tenantId: TENANT_A, receiptId: id, notes: 'Faltaron cajas', lines: [{ orderLineId: order.lines[1].id, quantity: 2 }] });
    expect(await latestReceipt(s)).toMatchObject({ notes: 'Faltaron cajas', lines: [{ sku: 'JABON', quantity: 2 }] });

    await s.confirmReceipt.run({ tenantId: TENANT_A, receiptId: id });
    await expect(s.updateReceipt.run({ tenantId: TENANT_A, receiptId: id, lines: [] })).rejects.toThrow(GoodsReceiptNotEditableError);
  });

  it('refuses to confirm a draft receipt whose item was deactivated after it was written', async () => {
    const { s, order } = await confirmedOrder();
    await s.createReceipt.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 1 }] });
    s.catalog.items.find((item) => item.id === WATER)!.isActive = false;

    await expect(s.confirmReceipt.run({ tenantId: TENANT_A, receiptId: (await latestReceipt(s)).id })).rejects.toThrow(InactivePurchaseItemError);
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(0);
  });

  // La orden anuncio 10 cajas como 240 unidades en camino: lo que entra tiene que cuadrar con eso,
  // aunque el articulo diga despues que su caja trae 12.
  it('receives in the base units the order promised, whatever the item says today', async () => {
    const { s, order } = await confirmedOrder();
    s.catalog.items.find((item) => item.id === WATER)!.units.find((unit) => unit.unitId === BOX)!.conversionFactor = 12;

    await receive(s, order.id, [{ orderLineId: order.lines[0].id, quantity: 10 }]);

    expect((await latestReceipt(s)).lines[0]).toMatchObject({ quantity: 10, baseQuantity: 240 });
    expect(s.store.stockOf(TENANT_A, WATER, MAIN)).toBe(240);
  });
});
