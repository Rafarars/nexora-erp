import { TenantId } from '../../shared/tenant-id.vo.js';
import { PurchaseOrder, PurchaseOrderId } from '../purchase-order.entity.js';

export const PURCHASE_ORDER_POSTING = Symbol('PurchaseOrderPosting');

// Cambia el estado de una orden con su fila bloqueada: confirmar y anular a la vez, o anular
// mientras una entrada la recibe, se ejecutan en fila y el segundo ve lo que dejo el primero.
// `work` es sincrono y puro: si lanza, no se escribe nada.
export interface PurchaseOrderPosting {
  post(tenantId: TenantId, orderId: PurchaseOrderId, work: (order: PurchaseOrder) => void): Promise<void>;
}
