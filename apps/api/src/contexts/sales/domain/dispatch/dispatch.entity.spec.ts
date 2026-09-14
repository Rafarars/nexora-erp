import { describe, expect, it } from 'vitest';
import {
  DispatchAlreadyCancelledError,
  DispatchAlreadyInvoicedError,
  DispatchExceedsPendingError,
  DispatchInvoicedError,
  DispatchNotConfirmableError,
  DispatchNotInvoiceableError,
  DuplicateDispatchLineError,
  EmptyDispatchError,
  InvoiceAlreadyCancelledError,
} from '../errors/sales.errors.js';
import { Invoice, InvoiceId } from '../invoice/invoice.entity.js';
import { SalesOrderLine } from '../order/sales-order-line.js';
import { SalesOrder } from '../order/sales-order.entity.js';
import { Quantity } from '../shared/quantity.vo.js';
import { SalesDate } from '../shared/sales-date.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { NOW, SOAP, TENANT_A, TODAY, aConfirmedOrder, anOrderLine } from '../testing/sales.mother.js';
import { DispatchLine, DispatchLineId } from './dispatch-line.js';
import { Dispatch, DispatchId } from './dispatch.entity.js';
import { DispatchCancellation } from './posting/dispatch-cancellation.js';
import { DispatchConfirmation } from './posting/dispatch-confirmation.js';

let counter = 0;
const nextId = () => `5c000000-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`;

function dispatchLine(orderLine: SalesOrderLine, quantity: number): DispatchLine {
  const q = Quantity.of(quantity);

  return DispatchLine.of({
    id: DispatchLineId.of(nextId()),
    lineNumber: counter,
    orderLineId: orderLine.id,
    itemId: orderLine.itemId,
    unitId: orderLine.unitId,
    quantity: q,
    baseQuantity: orderLine.baseOf(q),
  });
}

function aDispatch(order: SalesOrder, lines: DispatchLine[], date = TODAY): Dispatch {
  return Dispatch.draft(DispatchId.of(nextId()), TenantId.of(TENANT_A), 'DES000001', { id: order.id, warehouseId: order.warehouseId() }, {
    date: SalesDate.of(date),
    notes: null,
    lines,
  }, NOW);
}

function aConfirmedDispatch(order: SalesOrder, lines: DispatchLine[]): Dispatch {
  const dispatch = aDispatch(order, lines);

  new DispatchConfirmation().apply(dispatch, order, NOW);

  return dispatch;
}

const issue = (dispatch: Dispatch, order: SalesOrder, overrides: { alreadyInvoiced?: boolean; paymentTermDays?: number } = {}) =>
  Invoice.issue(InvoiceId.of(nextId()), TenantId.of(TENANT_A), 'FAC000001', {
    dispatch,
    order,
    alreadyInvoiced: overrides.alreadyInvoiced ?? false,
    paymentTermDays: overrides.paymentTermDays ?? 30,
    date: SalesDate.of(TODAY),
    notes: null,
    lineIds: nextId,
  }, NOW);

describe('Dispatch', () => {
  it('needs lines, each order line once', () => {
    const line = anOrderLine();
    const order = aConfirmedOrder([line]);

    expect(() => aDispatch(order, [])).toThrow(EmptyDispatchError);
    expect(() => aDispatch(order, [dispatchLine(line, 1), dispatchLine(line, 1)])).toThrow(DuplicateDispatchLineError);
  });

  it('takes the base quantity in proportion to the order line, which is what it reserved', () => {
    expect(dispatchLine(anOrderLine({ quantity: 10, factor: 24 }), 2.5).baseQuantity.toNumber()).toBe(60);
  });

  describe('confirming', () => {
    it('registers the dispatched quantities on the order and asks the inventory to release base units', () => {
      const line = anOrderLine({ quantity: 10 });
      const order = aConfirmedOrder([line]);
      const dispatch = aDispatch(order, [dispatchLine(line, 4)]);

      const result = new DispatchConfirmation().apply(dispatch, order, NOW);

      expect(order.currentStatus()).toBe('partially_dispatched');
      expect(result.stock.kind === 'release' && result.stock.exits.map((e) => [e.quantity.toNumber(), e.warehouseId.value])).toEqual([[96, order.warehouseId().value]]);
    });

    it('fails without registering anything when the order no longer has that much pending', () => {
      const line = anOrderLine({ quantity: 5 });
      const order = aConfirmedOrder([line]);
      order.registerDispatch([{ orderLineId: line.id, quantity: Quantity.of(4) }], NOW);

      expect(() => new DispatchConfirmation().apply(aDispatch(order, [dispatchLine(line, 2)]), order, NOW)).toThrow(DispatchExceedsPendingError);
      expect(line.dispatchedQuantity().toNumber()).toBe(4);
    });

    it('is confirmed only once', () => {
      const line = anOrderLine();
      const order = aConfirmedOrder([line]);
      const dispatch = aConfirmedDispatch(order, [dispatchLine(line, 1)]);

      expect(() => dispatch.confirm(NOW)).toThrow(DispatchNotConfirmableError);
    });
  });

  describe('cancelling', () => {
    it('discards a draft without touching the order or the stock', () => {
      const line = anOrderLine();
      const order = aConfirmedOrder([line]);

      expect(new DispatchCancellation().apply(aDispatch(order, [dispatchLine(line, 1)]), order, false, NOW).stock).toEqual({ kind: 'none' });
    });

    it('gives the quantities back to the order, reserving them again, and asks the inventory to reverse', () => {
      const line = anOrderLine({ quantity: 3 });
      const order = aConfirmedOrder([line]);
      const dispatch = aConfirmedDispatch(order, [dispatchLine(line, 3)]);

      const result = new DispatchCancellation().apply(dispatch, order, false, NOW);

      expect(result.stock).toEqual({ kind: 'reverse' });
      expect(order.currentStatus()).toBe('confirmed');
      expect(() => dispatch.cancel(false, NOW)).toThrow(DispatchAlreadyCancelledError);
    });

    it('refuses to cancel a dispatch with an issued invoice', () => {
      const line = anOrderLine();
      const order = aConfirmedOrder([line]);
      const dispatch = aConfirmedDispatch(order, [dispatchLine(line, 1)]);

      expect(() => new DispatchCancellation().apply(dispatch, order, true, NOW)).toThrow(DispatchInvoicedError);
      expect(order.currentStatus()).toBe('partially_dispatched');
    });
  });

  it('survives a round trip to primitives', () => {
    const line = anOrderLine();
    const dispatch = aDispatch(aConfirmedOrder([line]), [dispatchLine(line, 1.5)]);

    expect(Dispatch.fromPrimitives(dispatch.toPrimitives()).toPrimitives()).toEqual(dispatch.toPrimitives());
  });
});

describe('Invoice', () => {
  it('charges what left in the dispatch at the order price and tax, and falls due after the payment term', () => {
    const [water, soap] = [anOrderLine({ quantity: 10, unitPrice: 30, taxRate: 16 }), anOrderLine({ quantity: 5, unitPrice: 2.5, taxRate: 0, item: SOAP })];
    const order = aConfirmedOrder([water, soap]);
    const dispatch = aConfirmedDispatch(order, [dispatchLine(water, 4), dispatchLine(soap, 5)]);

    const invoice = issue(dispatch, order, { paymentTermDays: 30 }).toPrimitives();

    expect(invoice).toMatchObject({
      status: 'issued',
      issueDate: '2026-01-15',
      dueDate: '2026-02-14',
      subtotal: 132.5,
      tax: 19.2,
      total: 151.7,
      lines: [
        { quantity: 4, unitPrice: 30, taxRate: 16, subtotal: 120, tax: 19.2 },
        { quantity: 5, unitPrice: 2.5, taxRate: 0, subtotal: 12.5, tax: 0 },
      ],
    });
  });

  it('falls due the same day when the customer pays cash', () => {
    const line = anOrderLine();
    const order = aConfirmedOrder([line]);

    expect(issue(aConfirmedDispatch(order, [dispatchLine(line, 1)]), order, { paymentTermDays: 0 }).toPrimitives().dueDate).toBe(TODAY);
  });

  it('invoices only a confirmed dispatch, once', () => {
    const line = anOrderLine();
    const order = aConfirmedOrder([line]);
    const draft = aDispatch(order, [dispatchLine(line, 1)]);
    const confirmed = aConfirmedDispatch(order, [dispatchLine(line, 1)]);

    expect(() => issue(draft, order)).toThrow(DispatchNotInvoiceableError);
    expect(() => issue(confirmed, order, { alreadyInvoiced: true })).toThrow(DispatchAlreadyInvoicedError);
  });

  it('is cancelled only once and keeps its amounts', () => {
    const line = anOrderLine();
    const order = aConfirmedOrder([line]);
    const invoice = issue(aConfirmedDispatch(order, [dispatchLine(line, 1)]), order);

    invoice.cancel(NOW);

    expect(invoice.toPrimitives()).toMatchObject({ status: 'cancelled', total: 34.8 });
    expect(() => invoice.cancel(NOW)).toThrow(InvoiceAlreadyCancelledError);
    expect(Invoice.fromPrimitives(invoice.toPrimitives()).toPrimitives()).toEqual(invoice.toPrimitives());
  });
});
