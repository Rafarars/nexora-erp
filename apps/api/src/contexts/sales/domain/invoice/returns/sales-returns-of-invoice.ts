import { SalesOrderLineId } from '../../order/sales-order-line.js';
import { TenantId } from '../../shared/tenant-id.vo.js';

export const SALES_RETURNS_OF_INVOICE = Symbol('SalesReturnsOfInvoice');

// Ventas no aprende de devoluciones, solo pregunta si hay mercancia devuelta de sus lineas.
export interface SalesReturnsOfInvoice {
  countConfirmedReturnsOf(tenantId: TenantId, orderLineIds: SalesOrderLineId[]): Promise<number>;
}
