import { TenantId } from '../shared/tenant-id.vo.js';
import { PurchaseOrder, PurchaseOrderId } from './purchase-order.entity.js';

export const PURCHASE_ORDER_REPOSITORY = Symbol('PurchaseOrderRepository');

// Guarda borradores: solo alcanza filas que siguen en borrador. Confirmar, anular y lo que
// reciben las entradas pasan por PurchaseOrderPosting o ReceiptPosting, con la orden bloqueada.
export interface PurchaseOrderRepository {
  save(order: PurchaseOrder): Promise<void>;
  find(tenantId: TenantId, id: PurchaseOrderId): Promise<PurchaseOrder | null>;
  searchByTenant(tenantId: TenantId): Promise<PurchaseOrder[]>;
}
