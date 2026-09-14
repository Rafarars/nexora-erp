import { Dispatch, DispatchPrimitives } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { DispatchPosting } from '../../domain/dispatch/posting/dispatch-posting.js';
import {
  DispatchNotEditableError,
  DispatchNotFoundError,
  InsufficientStockForDispatchError,
  InvoiceNotFoundError,
  SalesOrderNotEditableError,
  SalesOrderNotFoundError,
} from '../../domain/errors/sales.errors.js';
import { Invoice, InvoicePrimitives } from '../../domain/invoice/invoice.entity.js';
import { InvoiceRepository } from '../../domain/invoice/invoice.repository.js';
import { InvoicePosting } from '../../domain/invoice/posting/invoice-posting.js';
import { SalesOrderPosting } from '../../domain/order/posting/sales-order-posting.js';
import { SalesOrder, SalesOrderPrimitives } from '../../domain/order/sales-order.entity.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { Quantity } from '../../domain/shared/quantity.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SalesStock } from '../../domain/stock/sales-stock.js';

const key = (tenantId: string, itemId: string, warehouseId: string) => `${tenantId}|${itemId}|${warehouseId}`;

// Pedidos, despachos, facturas y un inventario de juguete en un solo almacen, porque en la base
// comparten transaccion. Imita lo que garantiza PostgreSQL: las publicaciones van de una en una,
// una que falla no deja nada escrito y la existencia nunca queda negativa.
//
// El inventario de juguete solo cuenta unidades por articulo y bodega. `stock` pone la existencia
// de partida y `withdraw` simula una salida por otro documento.
export class InMemorySalesStore {
  private readonly orderRows = new Map<string, SalesOrderPrimitives>();
  private readonly dispatchRows = new Map<string, DispatchPrimitives>();
  private readonly invoiceRows = new Map<string, InvoicePrimitives>();
  private readonly onHand = new Map<string, number>();
  private readonly released: { dispatchId: string; key: string; quantity: number; reversed: boolean }[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  stock(tenantId: string, itemId: string, warehouseId: string, quantity: number): void {
    this.onHand.set(key(tenantId, itemId, warehouseId), quantity);
  }

  withdraw(tenantId: string, itemId: string, warehouseId: string, quantity: number): void {
    const k = key(tenantId, itemId, warehouseId);

    this.onHand.set(k, (this.onHand.get(k) ?? 0) - quantity);
  }

  stockOf(tenantId: string, itemId: string, warehouseId: string): number {
    return this.onHand.get(key(tenantId, itemId, warehouseId)) ?? 0;
  }

  get salesStock(): SalesStock {
    return {
      onHand: async (tenantId, warehouseId) =>
        [...this.onHand.entries()]
          .map(([k, quantity]) => {
            const [tenant, itemId, warehouse] = k.split('|');

            return { tenant, itemId, warehouseId: warehouse, quantity };
          })
          .filter((row) => row.tenant === tenantId.value && (!warehouseId || row.warehouseId === warehouseId.value))
          .map(({ itemId, warehouseId: warehouse, quantity }) => ({ itemId, warehouseId: warehouse, quantity })),
    };
  }

  get orders(): SalesOrderRepository {
    return {
      save: async (order) => {
        const stored = this.orderRows.get(order.id.value);

        if (stored && stored.status !== 'draft') throw new SalesOrderNotEditableError(stored.id, stored.status);

        this.orderRows.set(order.id.value, structuredClone(order.toPrimitives()));
      },
      find: async (tenantId, id) => this.loadOrder(tenantId, id.value),
      searchByTenant: async (tenantId) =>
        [...this.orderRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .sort((a, b) => b.code.localeCompare(a.code))
          .map((row) => SalesOrder.fromPrimitives(structuredClone(row))),
    };
  }

  get dispatches(): DispatchRepository {
    return {
      save: async (dispatch) => {
        const stored = this.dispatchRows.get(dispatch.id.value);

        if (stored && stored.status !== 'draft') throw new DispatchNotEditableError(stored.id, stored.status);

        this.dispatchRows.set(dispatch.id.value, structuredClone(dispatch.toPrimitives()));
      },
      find: async (tenantId, id) => this.loadDispatch(tenantId, id.value),
      searchByTenant: async (tenantId, orderId) =>
        [...this.dispatchRows.values()]
          .filter((row) => row.tenantId === tenantId.value && (!orderId || row.orderId === orderId.value))
          .sort((a, b) => b.code.localeCompare(a.code))
          .map((row) => Dispatch.fromPrimitives(structuredClone(row))),
    };
  }

  get invoices(): InvoiceRepository {
    return {
      find: async (tenantId, id) => this.loadInvoice(tenantId, id.value),
      searchByTenant: async (tenantId) =>
        [...this.invoiceRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .sort((a, b) => b.code.localeCompare(a.code))
          .map((row) => Invoice.fromPrimitives(row)),
      issuedForDispatch: async (tenantId, dispatchId) => this.invoiced(tenantId.value, dispatchId.value),
    };
  }

  get orderPosting(): SalesOrderPosting {
    return {
      post: (tenantId, orderId, work) =>
        this.serial(async () => {
          const order = this.loadOrder(tenantId, orderId.value);

          if (!order) throw new SalesOrderNotFoundError(orderId.value);

          work(order, {
            onHand: (itemId, warehouseId) => Quantity.of(Math.max(0, this.stockOf(tenantId.value, itemId.value, warehouseId.value))),
            reservedByOthers: (itemId, warehouseId) =>
              [...this.orderRows.values()]
                .filter((row) => row.tenantId === tenantId.value && row.id !== order.id.value && row.warehouseId === warehouseId.value)
                .map((row) => SalesOrder.fromPrimitives(structuredClone(row)))
                .filter((other) => other.isDispatchable())
                .reduce((sum, other) => sum.plus(other.reservedByItem().get(itemId.value) ?? Quantity.zero()), Quantity.zero()),
          });
          this.orderRows.set(order.id.value, structuredClone(order.toPrimitives()));
        }),
    };
  }

  get dispatchPosting(): DispatchPosting {
    return {
      post: (tenantId, dispatchId, work) =>
        this.serial(async () => {
          const dispatch = this.loadDispatch(tenantId, dispatchId.value);

          if (!dispatch) throw new DispatchNotFoundError(dispatchId.value);

          const order = this.loadOrder(tenantId, dispatch.orderId.value) as SalesOrder;
          const result = work(dispatch, order, this.invoiced(tenantId.value, dispatch.id.value));
          const moves: { key: string; delta: number }[] = [];

          if (result.stock.kind === 'release') {
            for (const exit of result.stock.exits) {
              moves.push({ key: key(tenantId.value, exit.itemId.value, exit.warehouseId.value), delta: -exit.quantity.toNumber() });
            }
          }

          const reversing = result.stock.kind === 'reverse' ? this.released.filter((r) => r.dispatchId === dispatch.id.value && !r.reversed) : [];

          for (const r of reversing) moves.push({ key: r.key, delta: r.quantity });

          // Como el inventario de verdad: no sale lo que no hay.
          const after = new Map<string, number>();

          for (const move of moves) {
            const value = (after.get(move.key) ?? this.onHand.get(move.key) ?? 0) + move.delta;

            if (value < 0) throw new InsufficientStockForDispatchError(dispatch.id.value);
            after.set(move.key, value);
          }

          // Nada se escribe hasta que todo lo anterior paso: es la transaccion.
          for (const [k, value] of after) this.onHand.set(k, value);
          reversing.forEach((r) => (r.reversed = true));

          if (result.stock.kind === 'release') {
            this.released.push(
              ...result.stock.exits.map((exit) => ({
                dispatchId: dispatch.id.value,
                key: key(tenantId.value, exit.itemId.value, exit.warehouseId.value),
                quantity: exit.quantity.toNumber(),
                reversed: false,
              })),
            );
          }

          this.dispatchRows.set(dispatch.id.value, structuredClone(result.dispatch.toPrimitives()));
          this.orderRows.set(order.id.value, structuredClone(result.order.toPrimitives()));
        }),
    };
  }

  get invoicePosting(): InvoicePosting {
    return {
      issue: (tenantId, dispatchId, work) =>
        this.serial(async () => {
          const dispatch = this.loadDispatch(tenantId, dispatchId.value);

          if (!dispatch) throw new DispatchNotFoundError(dispatchId.value);

          const invoice = work(dispatch, this.loadOrder(tenantId, dispatch.orderId.value) as SalesOrder, this.invoiced(tenantId.value, dispatch.id.value));

          this.invoiceRows.set(invoice.id.value, invoice.toPrimitives());
        }),
      cancel: (tenantId, invoiceId, work) =>
        this.serial(async () => {
          const invoice = this.loadInvoice(tenantId, invoiceId.value);

          if (!invoice) throw new InvoiceNotFoundError(invoiceId.value);

          work(invoice);
          this.invoiceRows.set(invoice.id.value, invoice.toPrimitives());
        }),
    };
  }

  private invoiced(tenantId: string, dispatchId: string): boolean {
    return [...this.invoiceRows.values()].some((row) => row.tenantId === tenantId && row.dispatchId === dispatchId && row.status === 'issued');
  }

  private loadOrder(tenantId: TenantId, id: string): SalesOrder | null {
    const row = this.orderRows.get(id);

    return row && row.tenantId === tenantId.value ? SalesOrder.fromPrimitives(structuredClone(row)) : null;
  }

  private loadDispatch(tenantId: TenantId, id: string): Dispatch | null {
    const row = this.dispatchRows.get(id);

    return row && row.tenantId === tenantId.value ? Dispatch.fromPrimitives(structuredClone(row)) : null;
  }

  private loadInvoice(tenantId: TenantId, id: string): Invoice | null {
    const row = this.invoiceRows.get(id);

    return row && row.tenantId === tenantId.value ? Invoice.fromPrimitives(row) : null;
  }

  // En serie, como el bloqueo de filas de la base.
  private serial(run: () => Promise<void>): Promise<void> {
    const next = this.queue.then(run);

    this.queue = next.catch(() => undefined);

    return next;
  }
}
