import { TenantId } from '../../shared/tenant-id.vo.js';
import { SalesOrder, SalesOrderId } from '../sales-order.entity.js';
import { StockAvailability } from './stock-availability.js';

export const SALES_ORDER_POSTING = Symbol('SalesOrderPosting');

// Cambia el estado de un pedido con su fila bloqueada y, antes de ejecutar el trabajo, las
// existencias de sus articulos en su bodega. Dos pedidos que reservan el mismo articulo esperan
// en fila y el segundo ve lo que el primero reservo. `work` es sincrono y puro.
export interface SalesOrderPosting {
  post(tenantId: TenantId, orderId: SalesOrderId, work: (order: SalesOrder, availability: StockAvailability) => void): Promise<void>;
}
