import { TenantId } from '../shared/tenant-id.vo.js';
import { SalesOrder, SalesOrderId, SalesOrderStatus } from './sales-order.entity.js';

export const SALES_ORDER_REPOSITORY = Symbol('SalesOrderRepository');

// Lo que la pantalla de pedidos ofrece. `text` busca por codigo de pedido y por SKU o nombre de
// articulo de sus lineas. Las fechas se comparan contra la que declara el pedido.
export interface SalesOrderCriteria {
  text: string | null;
  customerId: string | null;
  warehouseId: string | null;
  status: SalesOrderStatus | null;
  from: string | null;
  to: string | null;
  limit: number;
  offset: number;
}

export interface SalesOrderPage {
  orders: SalesOrder[];
  total: number;
}

// Guarda borradores: solo alcanza filas que siguen en borrador. Confirmar, anular y lo que
// despachan los despachos pasan por SalesOrderPosting o DispatchPosting, con el pedido bloqueado.
export interface SalesOrderRepository {
  save(order: SalesOrder): Promise<void>;
  find(tenantId: TenantId, id: SalesOrderId): Promise<SalesOrder | null>;
  searchByTenant(tenantId: TenantId): Promise<SalesOrder[]>;
  searchPage(tenantId: TenantId, criteria: SalesOrderCriteria): Promise<SalesOrderPage>;
}
