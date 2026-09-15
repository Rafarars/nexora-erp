import { ItemRef, UnitRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { PurchaseOrder, PurchaseOrderId } from '../purchase-order.entity.js';

export const PURCHASE_ORDER_POSTING = Symbol('PurchaseOrderPosting');

// Los articulos de la orden tal como estan en el catalogo, bloqueados mientras dura la publicacion.
export interface OrderedItems {
  item(itemId: ItemRef): { isActive: boolean; type: 'inventoried' | 'service'; factorOf(unitId: UnitRef): number | null } | null;
}

// Cambia el estado de una orden con su fila bloqueada, y sus articulos en modo compartido:
// confirmar y anular a la vez, o anular mientras una entrada la recibe, se ejecutan en fila y el
// segundo ve lo que dejo el primero. `work` es sincrono y puro: si lanza, no se escribe nada.
export interface PurchaseOrderPosting {
  post(tenantId: TenantId, orderId: PurchaseOrderId, work: (order: PurchaseOrder, items: OrderedItems) => void): Promise<void>;
}
