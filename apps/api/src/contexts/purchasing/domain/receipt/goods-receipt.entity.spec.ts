import { describe, expect, it } from 'vitest';
import {
  DuplicateReceiptLineError,
  EmptyGoodsReceiptError,
  FuturePurchaseDateError,
  ReceiptBeforeOrderError,
  GoodsReceiptAlreadyCancelledError,
  GoodsReceiptNotConfirmableError,
  GoodsReceiptNotEditableError,
  ReceiptExceedsPendingError,
} from '../errors/purchasing.errors.js';
import { PurchaseOrderLine } from '../order/purchase-order-line.js';
import { PurchaseOrder } from '../order/purchase-order.entity.js';
import { UnitCost } from '../shared/money.js';
import { PurchaseDate } from '../shared/purchase-date.vo.js';
import { Quantity } from '../shared/quantity.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { NOW, TENANT_A, TODAY, aConfirmedOrder, aDocumentCurrency, anOrderLine } from '../testing/purchasing.mother.js';
import { GoodsReceiptLine, GoodsReceiptLineId } from './goods-receipt-line.js';
import { GoodsReceipt, GoodsReceiptId } from './goods-receipt.entity.js';
import { ReceiptCancellation } from './posting/receipt-cancellation.js';
import { ReceiptConfirmation } from './posting/receipt-confirmation.js';

let counter = 0;

function receiptLine(orderLine: PurchaseOrderLine, quantity: number, factor = 24): GoodsReceiptLine {
  counter += 1;
  const q = Quantity.of(quantity);

  return GoodsReceiptLine.of({
    id: GoodsReceiptLineId.of(`0e000000-0000-4000-8000-${String(counter).padStart(12, '0')}`),
    lineNumber: counter,
    orderLineId: orderLine.id,
    itemId: orderLine.itemId,
    itemSku: 'PRUEBA-SKU',
    itemName: 'Articulo de prueba',
    unitId: orderLine.unitId,
    quantity: q,
    baseQuantity: q.times(factor),
    unitCost: orderLine.unitCost,
  });
}

function aReceipt(order: PurchaseOrder, lines: GoodsReceiptLine[], date = TODAY, currency = aDocumentCurrency()): GoodsReceipt {
  return GoodsReceipt.draft(
    GoodsReceiptId.of('0f000000-0000-4000-8000-000000000001'),
    TenantId.of(TENANT_A),
    'ENT000001',
    { id: order.id, warehouseId: order.warehouseId(), date: order.orderDate() },
    { date: PurchaseDate.of(date), notes: '  Llego completo ', lines, currency },
    NOW, TODAY,
  );
}

describe('GoodsReceipt', () => {
  // 4 cajas de 24 a 12 EUR son 96 unidades a 0,50 EUR; con el euro a 175,05 Bs y el dolar a 153,10 Bs,
  // entran al inventario a 0,571685 USD.
  it('enters the stock at its cost carried to the company currency with its own rates', () => {
    const line = anOrderLine({ quantity: 10, unitCost: 12 });
    const order = aConfirmedOrder([line]);
    const receipt = aReceipt(order, [receiptLine(line, 4)], TODAY, aDocumentCurrency({ currency: 'EUR', exchangeRate: 175.05, baseExchangeRate: 153.1 }));

    const { stock } = new ReceiptConfirmation().apply(receipt, order, NOW);

    expect(stock.kind === 'receive' ? stock.entries.map((entry) => [entry.quantity.toNumber(), entry.unitCost.toNumber()]) : []).toEqual([[96, 0.571685]]);
  });

  it('is born as a draft in the warehouse of its order', () => {
    const line = anOrderLine();
    const order = aConfirmedOrder([line]);
    const receipt = aReceipt(order, [receiptLine(line, 2)]);

    expect(receipt.toPrimitives()).toMatchObject({ status: 'draft', orderId: order.id.value, warehouseId: order.warehouseId().value, notes: 'Llego completo' });
  });

  it('needs lines, each order line once, and a date that already happened', () => {
    const line = anOrderLine();
    const order = aConfirmedOrder([line]);

    expect(() => aReceipt(order, [])).toThrow(EmptyGoodsReceiptError);
    expect(() => aReceipt(order, [receiptLine(line, 1), receiptLine(line, 1)])).toThrow(DuplicateReceiptLineError);
    expect(() => aReceipt(order, [receiptLine(line, 1)], '2026-01-16')).toThrow(FuturePurchaseDateError);
  });

  // La mercancia no llega antes de pedirse, y esa fecha viaja al kardex.
  it('refuses a date earlier than its own order', () => {
    const line = anOrderLine();
    const order = aConfirmedOrder([line]);

    expect(() => aReceipt(order, [receiptLine(line, 1)], '2025-12-01')).toThrow(ReceiptBeforeOrderError);
    expect(() => aReceipt(order, [receiptLine(line, 1)], order.orderDate().value)).not.toThrow();
  });

  it('costs each base unit at the order cost spread over the box', () => {
    const line = anOrderLine({ unitCost: 12 });

    expect(receiptLine(line, 2).baseUnitCost()).toEqual(UnitCost.of(0.5));
  });

  describe('confirming', () => {
    it('registers the received quantities on the order and asks the inventory to receive base units', () => {
      const line = anOrderLine({ quantity: 10, unitCost: 12 });
      const order = aConfirmedOrder([line]);
      const receipt = aReceipt(order, [receiptLine(line, 4)]);

      const result = new ReceiptConfirmation().apply(receipt, order, NOW);

      expect(receipt.currentStatus()).toBe('confirmed');
      expect(order.currentStatus()).toBe('partially_received');
      expect(result.stock).toMatchObject({ kind: 'receive' });
      expect(result.stock.kind === 'receive' && result.stock.entries.map((e) => [e.quantity.toNumber(), e.unitCost.toNumber(), e.warehouseId.value])).toEqual([
        [96, 0.5, order.warehouseId().value],
      ]);
    });

    it('fails without registering anything when the order no longer has that much pending', () => {
      const line = anOrderLine({ quantity: 5 });
      const order = aConfirmedOrder([line]);
      order.registerReceipt([{ orderLineId: line.id, quantity: Quantity.of(4) }], NOW);
      const receipt = aReceipt(order, [receiptLine(line, 2)]);

      expect(() => new ReceiptConfirmation().apply(receipt, order, NOW)).toThrow(ReceiptExceedsPendingError);
      expect(line.receivedQuantity().toNumber()).toBe(4);
    });

    it('is confirmed only once and not edited afterwards', () => {
      const line = anOrderLine();
      const order = aConfirmedOrder([line]);
      const receipt = aReceipt(order, [receiptLine(line, 1)]);
      new ReceiptConfirmation().apply(receipt, order, NOW);

      expect(() => receipt.confirm(NOW)).toThrow(GoodsReceiptNotConfirmableError);
      expect(() => receipt.update({ date: PurchaseDate.of(TODAY), notes: null, lines: [receiptLine(line, 1)], currency: aDocumentCurrency() }, NOW, TODAY, order.orderDate())).toThrow(
        GoodsReceiptNotEditableError,
      );
    });
  });

  describe('cancelling', () => {
    it('discards a draft without touching the order or the stock', () => {
      const line = anOrderLine();
      const order = aConfirmedOrder([line]);
      const receipt = aReceipt(order, [receiptLine(line, 1)]);

      const result = new ReceiptCancellation().apply(receipt, order, NOW);

      expect(result.stock).toEqual({ kind: 'none' });
      expect(order.currentStatus()).toBe('confirmed');
    });

    it('gives the quantities back to the order and asks the inventory to reverse', () => {
      const line = anOrderLine({ quantity: 3 });
      const order = aConfirmedOrder([line]);
      const receipt = aReceipt(order, [receiptLine(line, 3)]);
      new ReceiptConfirmation().apply(receipt, order, NOW);
      expect(order.currentStatus()).toBe('received');

      const result = new ReceiptCancellation().apply(receipt, order, NOW);

      expect(result.stock).toEqual({ kind: 'reverse' });
      expect(order.currentStatus()).toBe('confirmed');
      expect(() => receipt.cancel(NOW)).toThrow(GoodsReceiptAlreadyCancelledError);
    });
  });

  it('survives a round trip to primitives', () => {
    const line = anOrderLine();
    const receipt = aReceipt(aConfirmedOrder([line]), [receiptLine(line, 1.5)]);

    expect(GoodsReceipt.fromPrimitives(receipt.toPrimitives()).toPrimitives()).toEqual(receipt.toPrimitives());
  });
});
