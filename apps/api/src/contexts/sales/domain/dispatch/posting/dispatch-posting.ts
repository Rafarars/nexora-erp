import { SalesOrder } from '../../order/sales-order.entity.js';
import { Quantity } from '../../shared/quantity.vo.js';
import { ItemRef, WarehouseRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { Dispatch, DispatchId } from '../dispatch.entity.js';

export const DISPATCH_POSTING = Symbol('DispatchPosting');

// Una salida para el inventario, en unidad base. El costo lo pone el inventario.
export interface DispatchStockExit {
  lineId: string;
  itemId: ItemRef;
  warehouseId: WarehouseRef;
  quantity: Quantity;
}

export type DispatchStockInstruction = { kind: 'none' } | { kind: 'release'; exits: DispatchStockExit[] } | { kind: 'reverse' };

export interface DispatchPostingResult {
  dispatch: Dispatch;
  order: SalesOrder;
  stock: DispatchStockInstruction;
}

// Confirma o anula un despacho en una transaccion: bloquea el despacho, luego su pedido y luego
// las existencias; ejecuta el trabajo y escribe despacho, pedido y existencia juntos. `invoiced`
// dice si el despacho tiene una factura emitida, leido con el despacho bloqueado.
//
// `work` es sincrono y puro. Si el inventario no tiene la existencia, lanza
// InsufficientStockForDispatchError y no se escribe nada.
export interface DispatchPosting {
  post(
    tenantId: TenantId,
    dispatchId: DispatchId,
    work: (dispatch: Dispatch, order: SalesOrder, invoiced: boolean) => DispatchPostingResult,
  ): Promise<void>;
}
