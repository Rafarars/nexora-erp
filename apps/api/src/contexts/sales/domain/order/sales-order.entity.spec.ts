import { describe, expect, it } from 'vitest';
import {
  DispatchExceedsPendingError,
  DispatchLineNotInOrderError,
  EmptySalesOrderError,
  FutureSalesDateError,
  InsufficientAvailabilityError,
  SalesOrderNotCancellableError,
  SalesOrderNotConfirmableError,
  SalesOrderNotDispatchableError,
  SalesOrderNotEditableError,
  SalesOrderWithDispatchesError,
} from '../errors/sales.errors.js';
import { CustomerId } from '../customer/customer.entity.js';
import { Quantity } from '../shared/quantity.vo.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { SalesDate } from '../shared/sales-date.vo.js';
import { CUSTOMER, MAIN, NOW, SOAP, TODAY, WATER, aConfirmedOrder, aDraftOrder, anAvailability, anOrderLine } from '../testing/sales.mother.js';
import { StockReservation } from './posting/stock-reservation.js';
import { SalesOrderLineId } from './sales-order-line.js';
import { SalesOrder } from './sales-order.entity.js';

const dispatched = (line: { id: SalesOrderLineId }, quantity: number) => ({ orderLineId: line.id, quantity: Quantity.of(quantity) });

describe('SalesOrder', () => {
  describe('as a draft', () => {
    it('needs at least one line and a date that already happened', () => {
      expect(() => aDraftOrder([])).toThrow(EmptySalesOrderError);
      expect(() =>
        aDraftOrder().update(
          { customerId: CustomerId.of(CUSTOMER), warehouseId: WarehouseRef.of(MAIN), orderDate: SalesDate.of('2026-01-16'), notes: null, currency: { currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualRate: false, toPrimitives: () => ({ currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false }) } as any, lines: [anOrderLine()] },
          NOW, TODAY,
        ),
      ).toThrow(FutureSalesDateError);
    });

    it('totals its lines with the tax each one carries', () => {
      const order = aDraftOrder([anOrderLine({ quantity: 10, unitPrice: 30, taxRate: 16 }), anOrderLine({ quantity: 2.5, unitPrice: 4, taxRate: 0, item: SOAP })]);

      expect(order.totals()).toEqual({ subtotal: 310, tax: 48, total: 358 });
    });

    it('is editable until it is confirmed, and confirmed only once', () => {
      const order = aConfirmedOrder();

      expect(() => order.update({ customerId: order.customerId(), warehouseId: order.warehouseId(), orderDate: order.orderDate(), notes: null, lines: [anOrderLine()] }, NOW, TODAY)).toThrow(
        SalesOrderNotEditableError,
      );
      expect(() => order.confirm(NOW)).toThrow(SalesOrderNotConfirmableError);
    });
  });

  // La regla central del pedido.
  describe('reserving stock when confirmed', () => {
    it('confirms when what it asks fits in what is on hand minus what others reserved', () => {
      const order = aDraftOrder([anOrderLine({ quantity: 10 })]);

      new StockReservation().confirm(order, anAvailability({ [WATER]: 300 }, { [WATER]: 60 }), NOW);

      expect(order.currentStatus()).toBe('confirmed');
    });

    it('refuses to reserve what is not available, and stays a draft', () => {
      const order = aDraftOrder([anOrderLine({ quantity: 10 })]);

      expect(() => new StockReservation().confirm(order, anAvailability({ [WATER]: 300 }, { [WATER]: 61 }), NOW)).toThrow(InsufficientAvailabilityError);
      expect(order.currentStatus()).toBe('draft');
    });

    it('adds up several lines of the same item before comparing', () => {
      const order = aDraftOrder([anOrderLine({ quantity: 5 }), anOrderLine({ quantity: 20, unit: 'e1111111-1111-4111-8111-111111111111', factor: 1 })]);

      expect(() => new StockReservation().confirm(order, anAvailability({ [WATER]: 139 }), NOW)).toThrow(InsufficientAvailabilityError);
      expect(() => new StockReservation().confirm(order, anAvailability({ [WATER]: 140 }), NOW)).not.toThrow();
    });

    it('treats stock reserved beyond what is on hand as nothing available', () => {
      expect(() => new StockReservation().confirm(aDraftOrder(), anAvailability({ [WATER]: 10 }, { [WATER]: 50 }), NOW)).toThrow(
        InsufficientAvailabilityError,
      );
    });

    it('reserves only what is still pending', () => {
      const line = anOrderLine({ quantity: 10 });
      const order = aConfirmedOrder([line]);
      order.registerDispatch([dispatched(line, 4)], NOW);

      expect(order.reservedByItem().get(WATER)?.toNumber()).toBe(144);
    });
  });

  describe('dispatching', () => {
    it('goes to partially dispatched, then to dispatched', () => {
      const [water, soap] = [anOrderLine({ quantity: 10 }), anOrderLine({ quantity: 4, item: SOAP })];
      const order = aConfirmedOrder([water, soap]);

      order.registerDispatch([dispatched(water, 10), dispatched(soap, 1)], NOW);
      expect(order.currentStatus()).toBe('partially_dispatched');

      order.registerDispatch([dispatched(soap, 3)], NOW);
      expect(order.currentStatus()).toBe('dispatched');
    });

    it('never dispatches more than what is pending, and validates every line before touching any', () => {
      const [first, second] = [anOrderLine({ quantity: 5 }), anOrderLine({ quantity: 5 })];
      const order = aConfirmedOrder([first, second]);

      expect(() => order.registerDispatch([dispatched(first, 5), dispatched(second, 6)], NOW)).toThrow(DispatchExceedsPendingError);
      expect(first.dispatchedQuantity().isZero()).toBe(true);
      expect(() => order.registerDispatch([dispatched(anOrderLine(), 1)], NOW)).toThrow(DispatchLineNotInOrderError);
    });

    it('does not dispatch a draft', () => {
      const line = anOrderLine();

      expect(() => aDraftOrder([line]).registerDispatch([dispatched(line, 1)], NOW)).toThrow(SalesOrderNotDispatchableError);
    });

    it('steps back when a dispatch is reverted', () => {
      const line = anOrderLine({ quantity: 10 });
      const order = aConfirmedOrder([line]);
      order.registerDispatch([dispatched(line, 10)], NOW);

      order.revertDispatch([dispatched(line, 10)], NOW);

      expect(order.currentStatus()).toBe('confirmed');
      expect(line.pendingBase().toNumber()).toBe(240);
    });
  });

  describe('cancelling', () => {
    it('cancels a draft or a confirmed order with nothing dispatched, releasing the reservation', () => {
      const order = aConfirmedOrder();

      order.cancel(NOW);

      expect(order.currentStatus()).toBe('cancelled');
      expect(order.isDispatchable()).toBe(false);
      expect(() => order.cancel(NOW)).toThrow(SalesOrderNotCancellableError);
    });

    it('refuses to cancel an order that already dispatched goods', () => {
      const line = anOrderLine();
      const order = aConfirmedOrder([line]);
      order.registerDispatch([dispatched(line, 1)], NOW);

      expect(() => order.cancel(NOW)).toThrow(SalesOrderWithDispatchesError);
    });
  });

  it('survives a round trip to primitives', () => {
    const line = anOrderLine({ quantity: 3.5, unitPrice: 1.234567, taxRate: 12.5 });
    const order = aConfirmedOrder([line]);
    order.registerDispatch([dispatched(line, 1.25)], NOW);

    expect(SalesOrder.fromPrimitives(order.toPrimitives()).toPrimitives()).toEqual(order.toPrimitives());
  });
});
