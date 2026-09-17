import { describe, expect, it } from 'vitest';
import {
  EmptyPurchaseOrderError,
  ExpectedDateBeforeOrderError,
  FuturePurchaseDateError,
  PurchaseOrderNotCancellableError,
  PurchaseOrderNotConfirmableError,
  PurchaseOrderNotEditableError,
  PurchaseOrderNotReceivableError,
  PurchaseOrderWithReceiptsError,
  ReceiptExceedsPendingError,
  ReceiptLineNotInOrderError,
} from '../errors/purchasing.errors.js';
import { PurchaseDate } from '../shared/purchase-date.vo.js';
import { Quantity } from '../shared/quantity.vo.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { SupplierId } from '../supplier/supplier.entity.js';
import { MAIN, NOW, SUPPLIER, TODAY, aConfirmedOrder, aDocumentCurrency, aDraftOrder, anOrderLine } from '../testing/purchasing.mother.js';
import { PurchaseOrderLineId } from './purchase-order-line.js';
import { PurchaseOrder } from './purchase-order.entity.js';

const received = (line: { id: PurchaseOrderLineId }, quantity: number) => ({ orderLineId: line.id, quantity: Quantity.of(quantity) });
const details = (overrides: Partial<Parameters<PurchaseOrder['update']>[0]> = {}) => ({
  supplierId: SupplierId.of(SUPPLIER),
  warehouseId: WarehouseRef.of(MAIN),
  orderDate: PurchaseDate.of('2026-01-10'),
  expectedDate: null,
  notes: null,
  lines: [anOrderLine()],
  currency: aDocumentCurrency(),
  ...overrides,
});

describe('PurchaseOrder', () => {
  describe('as a draft', () => {
    it('needs at least one line', () => {
      expect(() => aDraftOrder([])).toThrow(EmptyPurchaseOrderError);
    });

    it('cannot be dated in the future, but can expect the goods later', () => {
      const order = aDraftOrder();

      expect(() => order.update(details({ orderDate: PurchaseDate.of('2026-01-16') }), NOW, TODAY)).toThrow(FuturePurchaseDateError);
      expect(() => order.update(details({ expectedDate: PurchaseDate.of('2026-03-01') }), NOW, TODAY)).not.toThrow();
    });

    it('cannot expect the goods before it was ordered', () => {
      expect(() => aDraftOrder().update(details({ expectedDate: PurchaseDate.of('2026-01-09') }), NOW, TODAY)).toThrow(
        ExpectedDateBeforeOrderError,
      );
    });

    it('totals its lines with the tax each one carries', () => {
      const order = aDraftOrder([anOrderLine({ quantity: 10, unitCost: 12, taxRate: 16 }), anOrderLine({ quantity: 2.5, unitCost: 4, taxRate: 0 })]);

      expect(order.totals(2)).toEqual({ subtotal: 130, tax: 19.2, total: 149.2 });
    });

    it('is editable until it is confirmed, and confirmed only once', () => {
      const order = aDraftOrder();

      order.confirm(NOW);

      expect(order.currentStatus()).toBe('confirmed');
      expect(() => order.update(details(), NOW, TODAY)).toThrow(PurchaseOrderNotEditableError);
      expect(() => order.confirm(NOW)).toThrow(PurchaseOrderNotConfirmableError);
    });

    it('does not receive goods before it is confirmed', () => {
      const line = anOrderLine();
      const order = aDraftOrder([line]);

      expect(() => order.registerReceipt([received(line, 1)], NOW)).toThrow(PurchaseOrderNotReceivableError);
    });
  });

  describe('receiving', () => {
    it('goes to partially received, then to received when every line is complete', () => {
      const [water, soap] = [anOrderLine({ quantity: 10 }), anOrderLine({ quantity: 4 })];
      const order = aConfirmedOrder([water, soap]);

      order.registerReceipt([received(water, 10), received(soap, 1)], NOW);
      expect(order.currentStatus()).toBe('partially_received');
      expect(soap.pending().toNumber()).toBe(3);

      order.registerReceipt([received(soap, 3)], NOW);
      expect(order.currentStatus()).toBe('received');
    });

    // La regla central de la recepcion.
    it('never receives more than what is pending', () => {
      const line = anOrderLine({ quantity: 10 });
      const order = aConfirmedOrder([line]);

      order.registerReceipt([received(line, 7)], NOW);

      expect(() => order.registerReceipt([received(line, 3.0001)], NOW)).toThrow(ReceiptExceedsPendingError);
      expect(line.receivedQuantity().toNumber()).toBe(7);
    });

    // Todo o nada: la segunda linea se pasa y la primera tampoco queda registrada.
    it('validates every line before registering any', () => {
      const [first, second] = [anOrderLine({ quantity: 5 }), anOrderLine({ quantity: 5 })];
      const order = aConfirmedOrder([first, second]);

      expect(() => order.registerReceipt([received(first, 5), received(second, 6)], NOW)).toThrow(ReceiptExceedsPendingError);

      expect(first.receivedQuantity().isZero()).toBe(true);
      expect(order.currentStatus()).toBe('confirmed');
    });

    it('refuses a line that belongs to another order', () => {
      const order = aConfirmedOrder();

      expect(() => order.registerReceipt([received(anOrderLine(), 1)], NOW)).toThrow(ReceiptLineNotInOrderError);
    });

    it('knows what is still pending in base units', () => {
      const line = anOrderLine({ quantity: 2, factor: 24 });
      aConfirmedOrder([line]).registerReceipt([received(line, 0.5)], NOW);

      expect(line.pendingBase().toNumber()).toBe(36);
    });

    it('steps back when a receipt is reverted', () => {
      const line = anOrderLine({ quantity: 10 });
      const order = aConfirmedOrder([line]);

      order.registerReceipt([received(line, 4)], NOW);
      order.registerReceipt([received(line, 6)], NOW);
      expect(order.currentStatus()).toBe('received');

      order.revertReceipt([received(line, 6)], NOW);
      expect(order.currentStatus()).toBe('partially_received');

      order.revertReceipt([received(line, 4)], NOW);
      expect(order.currentStatus()).toBe('confirmed');
      expect(line.pending().toNumber()).toBe(10);
    });
  });

  describe('cancelling', () => {
    it('cancels a draft or a confirmed order with nothing received', () => {
      const draft = aDraftOrder();
      const confirmed = aConfirmedOrder();

      draft.cancel(NOW);
      confirmed.cancel(NOW);

      expect([draft.currentStatus(), confirmed.currentStatus()]).toEqual(['cancelled', 'cancelled']);
    });

    it('refuses to cancel an order that already received goods', () => {
      const line = anOrderLine();
      const order = aConfirmedOrder([line]);
      order.registerReceipt([received(line, 1)], NOW);

      expect(() => order.cancel(NOW)).toThrow(PurchaseOrderWithReceiptsError);
    });

    it('cannot be cancelled twice, nor receive once cancelled', () => {
      const line = anOrderLine();
      const order = aConfirmedOrder([line]);
      order.cancel(NOW);

      expect(() => order.cancel(NOW)).toThrow(PurchaseOrderNotCancellableError);
      expect(() => order.registerReceipt([received(line, 1)], NOW)).toThrow(PurchaseOrderNotReceivableError);
    });
  });

  it('survives a round trip to primitives, received quantities included', () => {
    const line = anOrderLine({ quantity: 3.5, unitCost: 1.234567, taxRate: 12.5 });
    const order = aConfirmedOrder([line]);
    order.registerReceipt([received(line, 1.25)], NOW);

    expect(PurchaseOrder.fromPrimitives(order.toPrimitives()).toPrimitives()).toEqual(order.toPrimitives());
  });
});
