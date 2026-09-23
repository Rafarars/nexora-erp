import { ConcurrentModificationError } from '../../../shared/domain/concurrent-modification.error.js';
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
  QuantityExceedsDispatchedReturnQuotaError,
  ReturnBeforeDispatchError,
  ReturnCustomerMismatchError,
  SalesItemChangedError,
  SalesOrderNotEditableError,
  SalesReturnAlreadyCancelledError,
  SalesReturnNotEditableError,
} from '../domain/errors/sales.errors.js';
import { Invoice, InvoiceId } from '../domain/invoice/invoice.entity.js';
import { StockReservation } from '../domain/order/posting/stock-reservation.js';
import { SalesOrderLine } from '../domain/order/sales-order-line.js';
import { SalesOrder, SalesOrderId } from '../domain/order/sales-order.entity.js';
import { SalesReturnLine, SalesReturnLineId } from '../domain/return/sales-return-line.js';
import { ReturnCondition, SalesReturn, SalesReturnId } from '../domain/return/sales-return.entity.js';

import { Quantity } from '../domain/shared/quantity.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../domain/shared/references.vo.js';
import { SalesDate } from '../domain/shared/sales-date.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { aDocumentCurrency, BOX, CUSTOMER, MAIN, NOW, PIECE, RETAIL_LIST, TENANT_A, TENANT_B, TODAY, WATER, anOrderLine } from '../domain/testing/sales.mother.js';
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

    async function draftOrder(lines: SalesOrderLine[], date = TODAY): Promise<SalesOrderId> {
      const id = SalesOrderId.of(`5b000000-0000-4000-8000-${next()}`);

      await ports.orders.save(
        SalesOrder.draft(id, tenant, `PED${next().slice(-6)}`, {
          customerId: CustomerId.of(CUSTOMER),
          warehouseId: WarehouseRef.of(MAIN),
          orderDate: SalesDate.of(date),
          currency: aDocumentCurrency(),
          notes: 'contrato',
          priceListId: null,
          lines,
        }, NOW, TODAY),
      );

      return id;
    }

    const confirmOrder = (id: SalesOrderId) => ports.orderPosting.post(tenant, id, (order, availability) => new StockReservation().confirm(order, availability, NOW));

    async function confirmedOrder(quantity: number, date = TODAY): Promise<SalesOrder> {
      const id = await draftOrder([pieces(quantity)], date);
      await confirmOrder(id);

      return (await ports.orders.find(tenant, id))!;
    }

    async function draftDispatch(order: SalesOrder, quantity: number, date = TODAY): Promise<DispatchId> {
      const id = DispatchId.of(`5d000000-0000-4000-8000-${next()}`);
      const [line] = order.lines();
      const q = Quantity.of(quantity);

      await ports.dispatches.save(
        Dispatch.draft(id, tenant, `DES${next().slice(-6)}`, { id: order.id, warehouseId: order.warehouseId(), date: order.orderDate() }, {
          date: SalesDate.of(date),
          notes: null,
          lines: [DispatchLine.of({ id: DispatchLineId.of(`5e000000-0000-4000-8000-${next()}`), lineNumber: 1, orderLineId: line.id, itemId: line.itemId, itemSku: line.itemSku, itemName: line.itemName, unitId: line.unitId, quantity: q, baseQuantity: line.baseOf(q) })],
        }, NOW, TODAY),
      );

      return id;
    }

    const confirmDispatch = (id: DispatchId) => ports.dispatchPosting.post(tenant, id, (d, o) => new DispatchConfirmation().apply(d, o, NOW));
    const cancelDispatch = (id: DispatchId) => ports.dispatchPosting.post(tenant, id, (d, o, invoiced) => new DispatchCancellation().apply(d, o, invoiced, NOW));
    const issue = (id: DispatchId, date = TODAY) =>
      ports.invoicePosting.issue(tenant, { dispatchId: id }, SalesDate.of(TODAY), 2, (dispatch, order, alreadyInvoiced, credit) =>
        Invoice.issue(InvoiceId.of(`5f000000-0000-4000-8000-${next()}`), tenant, `FAC${next().slice(-6)}`, {
          dispatch,
          order,
          currency: aDocumentCurrency(),
          amountDecimals: 2,
          alreadyInvoiced,
          credit,
          date: SalesDate.of(date),
          notes: null,
          lineIds: () => `5f100000-0000-4000-8000-${next()}`,
        }, NOW, TODAY),
      );

    async function draftReturn(
      dispatch: Dispatch,
      quantities: number[],
      condition: ReturnCondition = 'resalable',
      date = TODAY,
    ): Promise<SalesReturnId> {
      const id = SalesReturnId.of(`5c000000-0000-4000-8000-${next()}`);
      const lines = dispatch.lines().map((line, idx) => {
        const q = Quantity.of(quantities[idx] ?? 1);
        return SalesReturnLine.of({
          id: SalesReturnLineId.of(`5c100000-0000-4000-8000-${next()}`),
          lineNumber: idx + 1,
          dispatchLineId: line.id.value,
          itemId: line.itemId,
          itemSku: line.itemSku,
          itemName: line.itemName,
          unitId: line.unitId,
          quantity: q,
          baseQuantity: q,
          unitCost: 0,
          restoresMovementId: null,
        });
      });

      const customer = (await ports.customers.find(tenant, CustomerId.of(CUSTOMER)))!;
      await ports.returns.save(
        SalesReturn.draft(
          id,
          tenant,
          `DVV${next().slice(-6)}`,
          { id: customer.id },
          { id: dispatch.id, warehouseId: dispatch.warehouseId, date: dispatch.date() },
          dispatch.warehouseId,
          aDocumentCurrency(),
          {
            date: SalesDate.of(date),
            condition,
            reason: 'defect',
            notes: 'Devolucion contrato',
            lines,
          },
          NOW,
          TODAY,
        ),
      );

      return id;
    }

    async function draftOriginlessReturn(
      itemId: string,
      warehouseId: string,
      quantity: number,
      unitCost: number,
      condition: ReturnCondition = 'resalable',
      date = TODAY,
    ): Promise<SalesReturnId> {
      const id = SalesReturnId.of(`5c000000-0000-4000-8000-${next()}`);
      const q = Quantity.of(quantity);
      const line = SalesReturnLine.of({
        id: SalesReturnLineId.of(`5c100000-0000-4000-8000-${next()}`),
        lineNumber: 1,
        dispatchLineId: null,
        itemId: ItemRef.of(itemId),
        itemSku: 'AGUA',
        itemName: 'Agua Mineral',
        unitId: UnitRef.of(PIECE),
        quantity: q,
        baseQuantity: q,
        unitCost,
        restoresMovementId: null,
      });

      const customer = (await ports.customers.find(tenant, CustomerId.of(CUSTOMER)))!;
      await ports.returns.save(
        SalesReturn.draft(
          id,
          tenant,
          `DVV${next().slice(-6)}`,
          { id: customer.id },
          null,
          WarehouseRef.of(warehouseId),
          aDocumentCurrency(),
          {
            date: SalesDate.of(date),
            condition,
            reason: 'Venta antes de tener sistema',
            notes: null,
            lines: [line],
          },
          NOW,
          TODAY,
        ),
      );

      return id;
    }

    const confirmReturn = (id: SalesReturnId) => ports.returnPosting.confirm(tenant, id, NOW);
    const cancelReturn = (id: SalesReturnId) => ports.returnPosting.cancel(tenant, id, NOW);

    // La lista con la que se cotizo y el precio que sugirio: los guarda la fila del pedido y la de

    // cada linea, y vuelven enteros al leerlos.
    it('keeps the price list of the order and the list price of each line', async () => {
      const id = SalesOrderId.of(`5b000000-0000-4000-8000-${next()}`);

      await ports.orders.save(
        SalesOrder.draft(id, tenant, `PED${next().slice(-6)}`, {
          customerId: CustomerId.of(CUSTOMER),
          warehouseId: WarehouseRef.of(MAIN),
          orderDate: SalesDate.of(TODAY),
          currency: aDocumentCurrency(),
          notes: 'contrato',
          priceListId: RETAIL_LIST,
          lines: [anOrderLine({ quantity: 1, unit: PIECE, factor: 1, unitPrice: 1.75, listPrice: 2 })],
        }, NOW, TODAY),
      );

      const saved = (await ports.orders.find(tenant, id))?.toPrimitives();
      expect(saved?.priceListId).toBe(RETAIL_LIST);
      expect(saved?.lines[0]).toMatchObject({ unitPrice: 1.75, listPrice: 2 });
    });

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

      // Con los articulos bloqueados se ve la caja de hoy: 1 caja anotada como 12 no se reserva.
      it('refuses to reserve base quantities that no longer match the unit of the item', async () => {
        await harness.stock(WATER, MAIN, 100);
        const stale = await draftOrder([anOrderLine({ quantity: 1, unit: BOX, factor: 12, unitPrice: 2 })]);

        await expect(confirmOrder(stale)).rejects.toThrow(SalesItemChangedError);
        expect((await ports.orders.find(tenant, stale))?.currentStatus()).toBe('draft');
      });

      // Un servicio no sale de la bodega, asi que no reserva nada. Lo comprueba el contrato
      // porque el doble lo filtraba y la consulta de produccion no, y ninguno de los dos casos
      // que existian tenia una linea de servicio de otro pedido: coincidian por omision.
      it('does not let a service line of another order eat the available stock', async () => {
        await harness.stock(WATER, MAIN, 10);
        // Mixto a proposito: uno de solo servicios nace despachado y no entraria en el filtro.
        const mixed = await draftOrder([
          pieces(1),
          anOrderLine({ quantity: 9, unit: PIECE, factor: 1, unitPrice: 2, movesStock: false }),
        ]);
        await confirmOrder(mixed);

        // Reservada hay una sola unidad: el servicio no sale de la bodega. Caben nueve.
        const fits = await draftOrder([pieces(9)]);

        await expect(confirmOrder(fits)).resolves.not.toThrow();
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

      // Dos personas con el mismo borrador: la segunda que guarda no borra lo que guardo la primera.
      it('refuses to overwrite a draft that someone else saved in the meantime', async () => {
        const id = await draftOrder([pieces(1)]);
        const first = (await ports.orders.find(tenant, id))!;
        const second = (await ports.orders.find(tenant, id))!;
        const details = (notes: string) => ({
          customerId: CustomerId.of(CUSTOMER),
          warehouseId: WarehouseRef.of(MAIN),
          orderDate: SalesDate.of(TODAY),
          currency: first.currency(),
          notes,
          priceListId: null,
          lines: [pieces(1)],
        });

        first.update(details('primero'), new Date(NOW.getTime() + 1000), TODAY);
        await ports.orders.save(first);
        second.update(details('segundo'), new Date(NOW.getTime() + 2000), TODAY);

        await expect(ports.orders.save(second)).rejects.toThrow(ConcurrentModificationError);
        expect((await ports.orders.find(tenant, id))?.toPrimitives().notes).toBe('primero');
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

        await ports.invoicePosting.cancel(tenant, invoice.id, (found, _order, paid) => found.cancel(NOW, paid));
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

      // La fecha viaja al pedido y al despacho: una factura vieja lo es porque lo que cobra
      // tambien es viejo, no porque se le haya puesto otra fecha encima.
      async function invoicedDispatch(quantity: number, date = TODAY): Promise<DispatchId> {
        const id = await draftDispatch(await confirmedOrder(quantity, date), quantity, date);
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
        const [old, recent, next] = [await invoicedDispatch(4, '2026-01-01'), await invoicedDispatch(4), await invoicedDispatch(1)];
        await limitCredit(20);

        // Vence el 11 y hoy es 15.
        await issue(old, '2026-01-01');
        await expect(issue(recent)).rejects.toThrow(CustomerWithOverdueInvoicesError);

        const [overdue] = await ports.invoices.searchByTenant(tenant);
        await harness.pay(overdue.id.value, CUSTOMER, 9.28);

        await issue(recent);
        expect((await ports.invoicePosting.credit(tenant, CustomerId.of(CUSTOMER), SalesDate.of(TODAY), 2)).openBalance).toBe(9.28);
        await expect(issue(next)).resolves.toBeUndefined();
      });

      it('refuses to cancel an invoice with payments applied', async () => {
        await harness.stock(WATER, MAIN, 10);
        await issue(await invoicedDispatch(2));
        const [invoice] = await ports.invoices.searchByTenant(tenant);

        await harness.pay(invoice.id.value, CUSTOMER, 1);

        await expect(ports.invoicePosting.cancel(tenant, invoice.id, (found, _order, paid) => found.cancel(NOW, paid))).rejects.toThrow(InvoiceWithPaymentsError);
        expect((await ports.invoices.find(tenant, invoice.id))?.currentStatus()).toBe('issued');
      });
    });

    // Buscar y paginar es donde el doble y PostgreSQL se separan si nadie mira: mayusculas,
    // campos nulos y el orden entre paginas.
    describe('Search pages', () => {
      const page = { text: null, limit: 20, offset: 0 };

      it('searches customers by code, name and fiscal id, ignoring case, and pages with a stable order', async () => {
        const other = Customer.create(
          CustomerId.of('c2222222-2222-4222-8222-222222222222'),
          tenant,
          'CLI900002',
          { name: 'Aguas del Valle', fiscalId: 'J-30512345-6' },
          NOW,
        );
        await ports.customers.save(other);
        const criteria = { ...page, isActive: null };

        expect((await ports.customers.searchPage(tenant, { ...criteria, text: 'aguas' })).customers.map((c) => c.id.value)).toEqual([other.id.value]);
        expect((await ports.customers.searchPage(tenant, { ...criteria, text: 'AGUAS' })).customers.map((c) => c.id.value)).toEqual([other.id.value]);
        expect((await ports.customers.searchPage(tenant, { ...criteria, text: 'cli900002' })).total).toBe(1);
        // Un cliente sin identificacion fiscal no puede romper la busqueda por ese campo.
        expect((await ports.customers.searchPage(tenant, { ...criteria, text: '30512345' })).total).toBe(1);

        const first = await ports.customers.searchPage(tenant, { ...criteria, limit: 1, offset: 0 });
        const second = await ports.customers.searchPage(tenant, { ...criteria, limit: 1, offset: 1 });

        expect(first.total).toBe(2);
        expect(first.customers[0].id.value).not.toBe(second.customers[0].id.value);
      });

      it('tells apart the active customers from the inactive', async () => {
        const closed = Customer.create(CustomerId.of('c3333333-3333-4333-8333-333333333333'), tenant, 'CLI900003', { name: 'Cerrado' }, NOW);
        closed.deactivate(NOW);
        await ports.customers.save(closed);

        expect((await ports.customers.searchPage(tenant, { ...page, isActive: true })).customers.map((c) => c.id.value)).toEqual([CUSTOMER]);
        expect((await ports.customers.searchPage(tenant, { ...page, isActive: false })).customers.map((c) => c.id.value)).toEqual([closed.id.value]);
        expect((await ports.customers.searchPage(tenant, { ...page, isActive: null })).total).toBe(2);
      });

      it('searches orders by code and by the sku or name of their lines, and filters by status and date', async () => {
        await harness.stock(WATER, MAIN, 10);
        const soap = await draftOrder([anOrderLine({ quantity: 1, unit: PIECE, factor: 1, unitPrice: 2, sku: 'JABON-01', name: 'Jabon azul' })], '2026-01-01');
        const water = await draftOrder([pieces(1)]);
        const confirmed = await confirmedOrder(2);
        const criteria = { ...page, customerId: null, warehouseId: null, status: null, from: null, to: null };
        const codeOf = async (id: SalesOrderId) => (await ports.orders.find(tenant, id))!.code;

        expect((await ports.orders.searchPage(tenant, { ...criteria, text: 'jabon-01' })).orders.map((o) => o.id.value)).toEqual([soap.value]);
        expect((await ports.orders.searchPage(tenant, { ...criteria, text: 'JABON AZUL' })).orders.map((o) => o.id.value)).toEqual([soap.value]);
        expect((await ports.orders.searchPage(tenant, { ...criteria, text: (await codeOf(water)).toLowerCase() })).orders.map((o) => o.id.value)).toEqual([water.value]);
        expect((await ports.orders.searchPage(tenant, { ...criteria, status: 'confirmed' })).orders.map((o) => o.id.value)).toEqual([confirmed.id.value]);
        expect((await ports.orders.searchPage(tenant, { ...criteria, customerId: CUSTOMER })).total).toBe(3);
        expect((await ports.orders.searchPage(tenant, { ...criteria, warehouseId: MAIN })).total).toBe(3);
        expect((await ports.orders.searchPage(tenant, { ...criteria, to: '2026-01-05' })).orders.map((o) => o.id.value)).toEqual([soap.value]);
        expect((await ports.orders.searchPage(tenant, { ...criteria, from: '2026-01-10' })).total).toBe(2);

        const first = await ports.orders.searchPage(tenant, { ...criteria, limit: 1, offset: 0 });
        const second = await ports.orders.searchPage(tenant, { ...criteria, limit: 1, offset: 1 });

        expect(first.total).toBe(3);
        expect(first.orders[0].id.value).not.toBe(second.orders[0].id.value);
      });

      it('searches dispatches by their code and by the code of their order, and filters by order and date', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(4, '2026-01-01');
        const id = await draftDispatch(order, 2, '2026-01-02');
        const code = (await ports.dispatches.find(tenant, id))!.toPrimitives().code;
        const criteria = { ...page, orderId: null, warehouseId: null, status: null, from: null, to: null };

        expect((await ports.dispatches.searchPage(tenant, { ...criteria, text: code.toLowerCase() })).dispatches.map((d) => d.id.value)).toEqual([id.value]);
        expect((await ports.dispatches.searchPage(tenant, { ...criteria, text: order.code.toLowerCase() })).dispatches.map((d) => d.id.value)).toEqual([id.value]);
        expect((await ports.dispatches.searchPage(tenant, { ...criteria, orderId: order.id.value })).total).toBe(1);
        expect((await ports.dispatches.searchPage(tenant, { ...criteria, warehouseId: MAIN })).total).toBe(1);
        expect((await ports.dispatches.searchPage(tenant, { ...criteria, status: 'confirmed' })).total).toBe(0);
        expect((await ports.dispatches.searchPage(tenant, { ...criteria, to: '2026-01-05' })).total).toBe(1);
        expect((await ports.dispatches.searchPage(tenant, { ...criteria, from: '2026-01-10' })).total).toBe(0);
      });

      it('searches invoices by their code, the code of their order and the name of the customer', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(4);
        const dispatchId = await draftDispatch(order, 4);
        await confirmDispatch(dispatchId);
        await issue(dispatchId);

        const [invoice] = await ports.invoices.searchByTenant(tenant);
        const criteria = { ...page, customerId: null, status: null, from: null, to: null };

        expect((await ports.invoices.searchPage(tenant, { ...criteria, text: invoice.toPrimitives().code.toLowerCase() })).invoices.map((i) => i.id.value)).toEqual([invoice.id.value]);
        expect((await ports.invoices.searchPage(tenant, { ...criteria, text: order.code.toLowerCase() })).total).toBe(1);
        expect((await ports.invoices.searchPage(tenant, { ...criteria, text: 'contrato cliente' })).total).toBe(1);
        expect((await ports.invoices.searchPage(tenant, { ...criteria, text: 'aguas' })).total).toBe(0);
        expect((await ports.invoices.searchPage(tenant, { ...criteria, customerId: CUSTOMER })).total).toBe(1);
        expect((await ports.invoices.searchPage(tenant, { ...criteria, status: 'cancelled' })).total).toBe(0);
        expect((await ports.invoices.searchPage(tenant, { ...criteria, to: TODAY })).total).toBe(1);
        expect((await ports.invoices.searchPage(tenant, { ...criteria, from: '2026-01-16' })).total).toBe(0);
      });
    });

    describe('SalesReturnRepository', () => {
      it('returns what it saved with its lines, and hides it from another tenant', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(5);
        const dispatchId = await draftDispatch(order, 5);
        await confirmDispatch(dispatchId);
        const dispatch = (await ports.dispatches.find(tenant, dispatchId))!;

        const returnId = await draftReturn(dispatch, [2]);
        const found = await ports.returns.find(tenant, returnId);

        expect(found?.toPrimitives()).toMatchObject({
          id: returnId.value,
          customerId: CUSTOMER,
          dispatchId: dispatchId.value,
          warehouseId: MAIN,
          status: 'draft',
          notes: 'Devolucion contrato',
        });
        expect(found?.lines()).toHaveLength(1);
        expect(found?.lines()[0].quantity.toNumber()).toBe(2);
        expect(await ports.returns.find(TenantId.of(TENANT_B), returnId)).toBeNull();
      });

      it('refuses to overwrite a draft that someone else saved in the meantime', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(5);
        const dispatchId = await draftDispatch(order, 5);
        await confirmDispatch(dispatchId);
        const dispatch = (await ports.dispatches.find(tenant, dispatchId))!;

        const returnId = await draftReturn(dispatch, [2]);
        const first = (await ports.returns.find(tenant, returnId))!;
        const second = (await ports.returns.find(tenant, returnId))!;

        first.update(
          {
            date: first.date(),
            condition: first.condition(),
            reason: null,
            notes: 'primero',
            lines: [...first.lines()],
          },
          dispatch.date(),
          new Date(NOW.getTime() + 1000),
          TODAY,
        );
        await ports.returns.save(first);

        second.update(
          {
            date: second.date(),
            condition: second.condition(),
            reason: null,
            notes: 'segundo',
            lines: [...second.lines()],
          },
          dispatch.date(),
          new Date(NOW.getTime() + 2000),
          TODAY,
        );
        await expect(ports.returns.save(second)).rejects.toThrow(ConcurrentModificationError);
      });

      it('refuses to overwrite a return that was confirmed in the meantime', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(5);
        const dispatchId = await draftDispatch(order, 5);
        await confirmDispatch(dispatchId);
        const dispatch = (await ports.dispatches.find(tenant, dispatchId))!;

        const returnId = await draftReturn(dispatch, [2]);
        const stale = (await ports.returns.find(tenant, returnId))!;
        await confirmReturn(returnId);

        await expect(ports.returns.save(stale)).rejects.toThrow(SalesReturnNotEditableError);
      });

      it('searches by criteria and counts confirmed returned quantities', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(6);
        const dispatchId = await draftDispatch(order, 6);
        await confirmDispatch(dispatchId);
        const dispatch = (await ports.dispatches.find(tenant, dispatchId))!;

        const return1 = await draftReturn(dispatch, [2]);
        await draftReturn(dispatch, [1]);
        await confirmReturn(return1);

        const page = await ports.returns.searchPage(tenant, {
          customerId: CUSTOMER,
          dispatchId: dispatchId.value,
          limit: 10,
          offset: 0,
        });

        expect(page.total).toBe(2);
        expect(page.returns).toHaveLength(2);

        const returned = await ports.returns.returnedQuantitiesByDispatch(tenant, dispatchId.value);
        const dispatchLineId = dispatch.lines()[0].id.value;
        expect(returned.get(dispatchLineId)).toBe(2);
      });
    });

    describe('SalesReturnPosting', () => {
      it('accepts two partial returns on the same dispatch line and rejects a third exceeding the quota, keeping sales order intact (H8 §3.3 & §3.11)', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(10);
        const dispatchId = await draftDispatch(order, 10);
        await confirmDispatch(dispatchId);
        const dispatch = (await ports.dispatches.find(tenant, dispatchId))!;

        // Stock tras despacho: 0
        expect(await harness.stockOf(WATER, MAIN)).toBe(0);

        const return1 = await draftReturn(dispatch, [4]);
        await confirmReturn(return1);
        expect(await harness.stockOf(WATER, MAIN)).toBe(4);

        const return2 = await draftReturn(dispatch, [4]);
        await confirmReturn(return2);
        expect(await harness.stockOf(WATER, MAIN)).toBe(8);

        // Tercera devolución de 3 excede el cupo disponible (10 - 8 = 2 < 3)
        const return3 = await draftReturn(dispatch, [3]);
        await expect(confirmReturn(return3)).rejects.toThrow(QuantityExceedsDispatchedReturnQuotaError);

        // El pedido de venta NO se modifica en absoluto (§3.11)
        const refreshedOrder = (await ports.orders.find(tenant, order.id))!;
        expect(refreshedOrder.toPrimitives()).toMatchObject({
          status: 'dispatched',
          lines: [{ dispatchedQuantity: 10 }],
        });
      });

      it('lets only one of two concurrent returns through when together they exceed the remaining quota', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(6);
        const dispatchId = await draftDispatch(order, 6);
        await confirmDispatch(dispatchId);
        const dispatch = (await ports.dispatches.find(tenant, dispatchId))!;

        const return1 = await draftReturn(dispatch, [4]);
        const return2 = await draftReturn(dispatch, [4]);

        const results = await Promise.allSettled([confirmReturn(return1), confirmReturn(return2)]);
        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(
          QuantityExceedsDispatchedReturnQuotaError,
        );
      });

      it('a scrap return does not generate stock movement and a resalable return does at the dispatch cost via restoresMovementId', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(6);
        const dispatchId = await draftDispatch(order, 6);
        await confirmDispatch(dispatchId);
        const dispatch = (await ports.dispatches.find(tenant, dispatchId))!;

        expect(await harness.stockOf(WATER, MAIN)).toBe(4);

        // Devolución scrap por 2 unidades
        const scrapReturnId = await draftReturn(dispatch, [2], 'scrap');
        const scrapConfirmed = await confirmReturn(scrapReturnId);
        expect(scrapConfirmed.currentStatus()).toBe('confirmed');

        // Scrap no mueve inventario (§3.5)
        expect(await harness.stockOf(WATER, MAIN)).toBe(4);
        if (harness.movementsOf) {
          const scrapMovements = await harness.movementsOf('sales_return', scrapReturnId.value);
          expect(scrapMovements).toHaveLength(0);
        }

        // Devolución resalable por 2 unidades
        const resalableReturnId = await draftReturn(dispatch, [2], 'resalable');
        const resalableConfirmed = await confirmReturn(resalableReturnId);
        expect(resalableConfirmed.currentStatus()).toBe('confirmed');

        // Resalable sí reingresa inventario al costo de la salida original
        expect(await harness.stockOf(WATER, MAIN)).toBe(6);
        if (harness.movementsOf) {
          const dispatchMovements = await harness.movementsOf('dispatch', dispatchId.value);
          expect(dispatchMovements.length).toBeGreaterThan(0);
          const origMovement = dispatchMovements[0];

          const resalableMovements = await harness.movementsOf('sales_return', resalableReturnId.value);
          expect(resalableMovements).toHaveLength(1);
          expect(resalableMovements[0]).toMatchObject({
            direction: 'in',
            quantity: 2,
            unitCost: origMovement.unitCost,
            restoresMovementId: origMovement.id,
            reversalOfId: null,
          });
        }
      });

      it('cancelling a return reverses its movement by reversalOfId and the other return keeps citing the same exit', async () => {
        await harness.stock(WATER, MAIN, 10);
        const order = await confirmedOrder(6);
        const dispatchId = await draftDispatch(order, 6);
        await confirmDispatch(dispatchId);
        const dispatch = (await ports.dispatches.find(tenant, dispatchId))!;

        const return1Id = await draftReturn(dispatch, [2], 'resalable');
        const return2Id = await draftReturn(dispatch, [2], 'resalable');

        await confirmReturn(return1Id);
        await confirmReturn(return2Id);
        expect(await harness.stockOf(WATER, MAIN)).toBe(8);

        // Anular la segunda devolución
        const cancelled = await cancelReturn(return2Id);
        expect(cancelled.currentStatus()).toBe('cancelled');
        expect(await harness.stockOf(WATER, MAIN)).toBe(6);

        if (harness.movementsOf) {
          const dispatchMovements = await harness.movementsOf('dispatch', dispatchId.value);
          const origMovement = dispatchMovements[0];

          // La primera devolución sigue citando la misma salida
          const return1Movements = await harness.movementsOf('sales_return', return1Id.value);
          expect(return1Movements).toHaveLength(1);
          expect(return1Movements[0].restoresMovementId).toBe(origMovement.id);

          // La devolución anulada tiene el movimiento original 'in' y la reversión 'out' con reversalOfId
          const return2Movements = await harness.movementsOf('sales_return', return2Id.value);
          expect(return2Movements).toHaveLength(2);
          const inMove = return2Movements.find((m) => m.direction === 'in')!;
          const revMove = return2Movements.find((m) => m.direction === 'out')!;
          expect(inMove.restoresMovementId).toBe(origMovement.id);
          expect(revMove.reversalOfId).toBe(inMove.id);
        }

        await expect(cancelReturn(return2Id)).rejects.toThrow(SalesReturnAlreadyCancelledError);
      });

      it('creates and confirms an originless return, restoring stock at written unitCost without dispatch or restoresMovementId (H8 §4.1 rule 3)', async () => {
        expect(await harness.stockOf(WATER, MAIN)).toBe(0);

        const returnId = await draftOriginlessReturn(WATER, MAIN, 5, 2.75, 'resalable');
        const confirmed = await confirmReturn(returnId);
        expect(confirmed.currentStatus()).toBe('confirmed');
        expect(confirmed.dispatchId).toBeNull();
        expect(confirmed.lines()[0].dispatchLineId).toBeNull();
        expect(confirmed.lines()[0].unitCost).toBe(2.75);
        expect(confirmed.lines()[0].restoresMovementId).toBeNull();

        expect(await harness.stockOf(WATER, MAIN)).toBe(5);

        if (harness.movementsOf) {
          const movements = await harness.movementsOf('sales_return', returnId.value);
          expect(movements).toHaveLength(1);
          expect(movements[0]).toMatchObject({
            direction: 'in',
            quantity: 5,
            unitCost: 2.75,
            restoresMovementId: null,
            reversalOfId: null,
          });
        }

        await cancelReturn(returnId);
        expect(await harness.stockOf(WATER, MAIN)).toBe(0);
        if (harness.movementsOf) {
          const movements = await harness.movementsOf('sales_return', returnId.value);
          expect(movements).toHaveLength(2);
          const revMove = movements.find((m) => m.direction === 'out')!;
          expect(revMove.reversalOfId).toBe(movements.find((m) => m.direction === 'in')!.id);
        }
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
