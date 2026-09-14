import { TenantId } from '../shared/tenant-id.vo.js';
import { SalesOrder, SalesOrderId } from './sales-order.entity.js';

export const SALES_ORDER_REPOSITORY = Symbol('SalesOrderRepository');

// Guarda borradores: solo alcanza filas que siguen en borrador. Confirmar, anular y lo que
// despachan los despachos pasan por SalesOrderPosting o DispatchPosting, con el pedido bloqueado.
export interface SalesOrderRepository {
  save(order: SalesOrder): Promise<void>;
  find(tenantId: TenantId, id: SalesOrderId): Promise<SalesOrder | null>;
  searchByTenant(tenantId: TenantId): Promise<SalesOrder[]>;
}
