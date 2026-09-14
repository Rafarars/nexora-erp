import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Customer, CustomerId } from '../domain/customer/customer.entity.js';
import { DispatchLine, DispatchLineId } from '../domain/dispatch/dispatch-line.js';
import { Dispatch, DispatchId } from '../domain/dispatch/dispatch.entity.js';
import { DispatchCancellation } from '../domain/dispatch/posting/dispatch-cancellation.js';
import { DispatchConfirmation } from '../domain/dispatch/posting/dispatch-confirmation.js';
import {
  CreditLimitExceededError,
  CustomerWithOverdueInvoicesError,
  DispatchAlreadyInvoicedError,
  DispatchExceedsPendingError,
  DispatchInvoicedError,
  DispatchNotFoundError,
  InsufficientAvailabilityError,
  InsufficientStockForDispatchError,
  InvoiceWithPaymentsError,
  SalesOrderNotEditableError,
} from '../domain/errors/sales.errors.js';
import { Invoice, InvoiceId } from '../domain/invoice/invoice.entity.js';
import { StockReservation } from '../domain/order/posting/stock-reservation.js';
import { SalesOrderLine } from '../domain/order/sales-order-line.js';
import { SalesOrder, SalesOrderId } from '../domain/order/sales-order.entity.js';
import { Quantity } from '../domain/shared/quantity.vo.js';
import { WarehouseRef } from '../domain/shared/references.vo.js';
import { SalesDate } from '../domain/shared/sales-date.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { CUSTOMER, MAIN, NOW, PIECE, TENANT_A, TENANT_B, TODAY, WATER, anOrderLine } from '../domain/testing/sales.mother.js';
import { SalesPorts, SalesPortsHarness } from './sales-ports.harness.js';

const tenant = TenantId.of(TENANT_A);

// UNA suite para el doble y para PostgreSQL. Lo que importa: que dos pedidos simultaneos no
// reserven la misma unidad, que entre dos despachos no salga mas de lo vendido y que un despacho
// se facture una sola vez.
export function describeSalesPortsContract(implementation: string, createHarness: () => SalesPortsHarness): void {
  describe(`Sales ports contract: ${implementation}`, () => {
    const harness = createHarness();
    let ports: SalesPorts;
    let counter = 0;

    beforeEach(async () => {
      await harness.reset();
      ports = harness.ports();
      await ports.customers.save(Customer.create(CustomerId.of(CUSTOMER), tenant, 'CLI900001', { name: 'Contrato cliente', paymentTermDays: 10 }, NOW));
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    const next = () => String((counter += 1)).padStart(12, '0');
    const pieces = (quantity: number) => anOrderLine({ quantity, unit: PIECE, factor: 1, unitPrice: 2 });

    async function draftOrder(lines: SalesOrderLine[]): Promise<SalesOrderId> {
      const id = SalesOrderId.of(`5b000000-0000-4000-8000-${next()}`);

      await ports.orders.save(
        SalesOrder.draft(id, tenant, `PED${next().slice(-6)}`, {
          customerId: CustomerId.of(CUSTOMER),
          warehouseId: WarehouseRef.of(MAIN),
          orderDate: SalesDate.of(TODAY),
          notes: 'contrato',
          lines,
        }, NOW),
      );

      return id;
    }

    const confirmOrder = (id: SalesOrderId) => ports.orderPosting.post(tenant, id, (order, availability) => new StockReservation().confirm(order, availability, NOW));

    async function confirmedOrder(quantity: number): Promise<SalesOrder> {
      const id = await draftOrder([pieces(quantity)]);
      await confirmOrder(id);

      return (await ports.orders.find(tenant, id))!;
    }

    async function draftDispatch(order: SalesOrder, quantity: number): Promise<DispatchId> {
      const id = DispatchId.of(`5d000000-0000-4000-8000-${next()}`);
      const [line] = order.lines();
      const q = Quantity.of(quantity);

      await ports.dispatches.save(
        Dispatch.draft(id, tenant, `DES${next().slice(-6)}`, { id: order.id, warehouseId: order.warehouseId() }, {
          date: SalesDate.of(TODAY),
          notes: null,
          lines: [DispatchLine.of({ id: DispatchLineId.of(`5e000000-0000-4000-8000-${next()}`), lineNumber: 1, orderLineId: line.id, itemId: line.itemId, unitId: line.unitId, quantity: q, baseQuantity: line.baseOf(q) })],
        }, NOW),
      );

      return id;
    }

    const confirmDispatch = (id: DispatchId) => ports.dispatchPosting.post(tenant, id, (d, o) => new DispatchConfirmation().apply(d, o, NOW));
    const cancelDispatch = (id: DispatchId) => ports.dispatchPosting.post(tenant, id, (d, o, invoiced) => new DispatchCancellation().apply(d, o, invoiced, NOW));
    const issue = (id: DispatchId, date = TODAY) =>
      ports.invoicePosting.issue(tenant, id, SalesDate.of(TODAY), (dispatch, order, alreadyInvoiced, credit) =>
        Invoice.issue(InvoiceId.of(`5f000000-0000-4000-8000-${next()}`), tenant, `FAC${next().slice(-6)}`, {
          dispatch,
          order,
          alreadyInvoiced,
          credit,
          date: SalesDate.of(date),
          notes: null,
          lineIds: () => `5f100000-0000-4000-8000-${next()}`,
        }, NOW),
      );

    describe('SalesOrderPosting', () => {
      it('confirms when the order fits and refuses without writing when it does not', async () => {
        await harness.stock(WATER, MAIN, 10);
        const fits = await draftOrder([pieces(7)]);
        const tooBig = await draftOrder([pieces(4)]);

        await confirmOrder(fits);

        await expect(confirmOrder(tooBig)).rejects.toThrow(InsufficientAvailabilityError);
        expect((await ports.orders.find(tenant, tooBig))?.currentStatus()).toBe('draft');
        expect(await harness.stockOf(WATER, MAIN)).toBe(10);
      });

      // La guarda de la reserva bajo concurrencia real: dos pedidos de 6 sobre 10.
      it('lets only one of two concurrent orders reserve when both do not fit', async () => {
        await harness.stock(WATER, MAIN, 10);
        const [first, second] = [await draftOrder([pieces(6)]), await draftOrder([pieces(6)])];

        const results = await Promise.allSettled([confirmOrder(first), confirmOrder(second)]);

        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientAvailabilityError);
      });

      it('releases the reservation when an order is cancelled, and counts only what is pending', async () => {
        await harness.stock(WATER, MAIN, 10);
        const first = await confirmedOrder(6);
        await confirmDispatch(await draftDispatch(first, 2));
        expect(await harness.stockOf(WATER, MAIN)).toBe(8);

        // Quedan 8 en bodega y 4 reservados: caben 4.
        const fits = await draftOrder([pieces(4)]);
        await confirmOrder(fits);
        await ports.orderPosting.post(tenant, fits, (order) => order.cancel(NOW));

        await expect(confirmOrder(await draftOrder([pieces(4)]))).resolves.toBeUndefined();
      });

      it('refuses to overwrite an order confirmed in the meantime', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(1);

        await expect(ports.orders.save(SalesOrder.fromPrimitives({ ...order.toPrimitives(), status: 'draft' }))).rejects.toThrow(SalesOrderNotEditableError);
      });
    });

    describe('DispatchPosting', () => {
      it('confirms: dispatch, order and stock change together', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(6);
        const id = await draftDispatch(order, 4);

        await confirmDispatch(id);

        expect((await ports.dispatches.find(tenant, id))?.currentStatus()).toBe('confirmed');
        expect((await ports.orders.find(tenant, order.id))?.toPrimitives()).toMatchObject({ status: 'partially_dispatched', lines: [{ dispatchedQuantity: 4 }] });
        expect(await harness.stockOf(WATER, MAIN)).toBe(6);
      });

      it('lets only one of two concurrent dispatches through when together they exceed the order', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(10);
        const [first, second] = [await draftDispatch(order, 6), await draftDispatch(order, 6)];

        const results = await Promise.allSettled([confirmDispatch(first), confirmDispatch(second)]);

        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(DispatchExceedsPendingError);
        expect(await harness.stockOf(WATER, MAIN)).toBe(4);
      });

      it('refuses a dispatch the warehouse cannot cover and writes nothing', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(10);
        const id = await draftDispatch(order, 10);
        await harness.stock(WATER, MAIN, 3);

        await expect(confirmDispatch(id)).rejects.toThrow(InsufficientStockForDispatchError);
        expect((await ports.dispatches.find(tenant, id))?.currentStatus()).toBe('draft');
        expect((await ports.orders.find(tenant, order.id))?.currentStatus()).toBe('confirmed');
      });

      it('cancels a confirmed dispatch: the stock comes back and the order steps back', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(5);
        const id = await draftDispatch(order, 5);
        await confirmDispatch(id);

        await cancelDispatch(id);

        expect(await harness.stockOf(WATER, MAIN)).toBe(10);
        expect((await ports.orders.find(tenant, order.id))?.currentStatus()).toBe('confirmed');
      });

      it('answers not found for a dispatch of another tenant', async () => {
        await harness.stock(WATER, MAIN, 10);
        const id = await draftDispatch(await confirmedOrder(1), 1);

        await expect(ports.dispatchPosting.post(TenantId.of(TENANT_B), id, (d, o) => new DispatchConfirmation().apply(d, o, NOW))).rejects.toThrow(DispatchNotFoundError);
      });
    });

    describe('InvoicePosting', () => {
      it('issues an invoice with its amounts and due date, and blocks cancelling the dispatch', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(4);
        const id = await draftDispatch(order, 4);
        await confirmDispatch(id);

        await issue(id);

        const [invoice] = await ports.invoices.searchByTenant(tenant);
        expect(invoice.toPrimitives()).toMatchObject({ status: 'issued', issueDate: TODAY, dueDate: '2026-01-25', subtotal: 8, tax: 1.28, total: 9.28, lines: [{ quantity: 4, subtotal: 8 }] });
        expect(await ports.invoices.issuedForDispatch(tenant, id)).toBe(true);
        await expect(cancelDispatch(id)).rejects.toThrow(DispatchInvoicedError);

        await ports.invoicePosting.cancel(tenant, invoice.id, (found, paid) => found.cancel(NOW, paid));
        expect(await ports.invoices.issuedForDispatch(tenant, id)).toBe(false);
        await expect(cancelDispatch(id)).resolves.toBeUndefined();
      });

      it('invoices a dispatch only once when asked twice at the same time', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(2);
        const id = await draftDispatch(order, 2);
        await confirmDispatch(id);

        const results = await Promise.allSettled([issue(id), issue(id)]);

        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(DispatchAlreadyInvoicedError);
        expect(await ports.invoices.searchByTenant(tenant)).toHaveLength(1);
      });

      async function invoicedDispatch(quantity: number): Promise<DispatchId> {
        const id = await draftDispatch(await confirmedOrder(quantity), quantity);
        await confirmDispatch(id);

        return id;
      }

      async function limitCredit(creditLimit: number | null): Promise<void> {
        const customer = (await ports.customers.find(tenant, CustomerId.of(CUSTOMER)))!;
        customer.update({ name: customer.name(), paymentTermDays: 10, creditLimit }, NOW);
        await ports.customers.save(customer);
      }

      // Dos facturas de 9,28 con 15 de limite: si no fueran en fila, las dos verian saldo cero.
      it('lets only one of two concurrent credit invoices through when both do not fit the limit', async () => {
        await harness.stock(WATER, MAIN, 10);
        const [first, second] = [await invoicedDispatch(4), await invoicedDispatch(4)];
        await limitCredit(15);

        const results = await Promise.allSettled([issue(first), issue(second)]);

        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(CreditLimitExceededError);
      });

      it('counts only what is still owed, and refuses credit while an invoice is overdue', async () => {
        await harness.stock(WATER, MAIN, 10);
        const [old, recent, next] = [await invoicedDispatch(4), await invoicedDispatch(4), await invoicedDispatch(1)];
        await limitCredit(20);

        // Vence el 11 y hoy es 15.
        await issue(old, '2026-01-01');
        await expect(issue(recent)).rejects.toThrow(CustomerWithOverdueInvoicesError);

        const [overdue] = await ports.invoices.searchByTenant(tenant);
        await harness.pay(overdue.id.value, CUSTOMER, 9.28);

        await issue(recent);
        expect((await ports.invoicePosting.credit(tenant, CustomerId.of(CUSTOMER), SalesDate.of(TODAY))).openBalance).toBe(9.28);
        await expect(issue(next)).resolves.toBeUndefined();
      });

      it('refuses to cancel an invoice with payments applied', async () => {
        await harness.stock(WATER, MAIN, 10);
        await issue(await invoicedDispatch(2));
        const [invoice] = await ports.invoices.searchByTenant(tenant);

        await harness.pay(invoice.id.value, CUSTOMER, 1);

        await expect(ports.invoicePosting.cancel(tenant, invoice.id, (found, paid) => found.cancel(NOW, paid))).rejects.toThrow(InvoiceWithPaymentsError);
        expect((await ports.invoices.find(tenant, invoice.id))?.currentStatus()).toBe('issued');
      });
    });

    describe('SalesCodeSequence', () => {
      it('counts each prefix per tenant', async () => {
        expect(await ports.codes.next(tenant, 'FAC')).toBe(1);
        expect(await ports.codes.next(tenant, 'FAC')).toBe(2);
        expect(await ports.codes.next(TenantId.of(TENANT_B), 'FAC')).toBe(1);
      });
    });
  });
}
