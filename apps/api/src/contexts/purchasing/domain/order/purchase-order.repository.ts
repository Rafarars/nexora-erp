import { TenantId } from '../shared/tenant-id.vo.js';
import { PurchaseOrder, PurchaseOrderId, PurchaseOrderStatus } from './purchase-order.entity.js';

export const PURCHASE_ORDER_REPOSITORY = Symbol('PurchaseOrderRepository');

// Lo que la pantalla de ordenes ofrece. `text` busca por codigo de orden y por SKU o nombre de
// articulo de sus lineas. Las fechas se comparan contra la que declara la orden.
export interface PurchaseOrderCriteria {
  text: string | null;
  supplierId: string | null;
  warehouseId: string | null;
  status: PurchaseOrderStatus | null;
  from: string | null;
  to: string | null;
  limit: number;
  offset: number;
}

export interface PurchaseOrderPage {
  orders: PurchaseOrder[];
  total: number;
}

// Guarda borradores: solo alcanza filas que siguen en borrador. Confirmar, anular y lo que
// reciben las entradas pasan por PurchaseOrderPosting o ReceiptPosting, con la orden bloqueada.
export interface PurchaseOrderRepository {
  save(order: PurchaseOrder): Promise<void>;
  find(tenantId: TenantId, id: PurchaseOrderId): Promise<PurchaseOrder | null>;
  searchByTenant(tenantId: TenantId): Promise<PurchaseOrder[]>;
  searchPage(tenantId: TenantId, criteria: PurchaseOrderCriteria): Promise<PurchaseOrderPage>;
  // Solo las que todavia esperan mercancia: en camino no tiene por que leer lo que va a descartar.
  searchOpen(tenantId: TenantId, warehouseId: string | null): Promise<PurchaseOrder[]>;
}
