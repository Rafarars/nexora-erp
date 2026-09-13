import { InventoryMovement } from '../../movement/inventory-movement.entity.js';
import { ItemRef, WarehouseRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { ItemStock } from '../../stock/item-stock.entity.js';
import { Adjustment, AdjustmentId } from '../adjustment.entity.js';

export const ADJUSTMENT_POSTING = Symbol('AdjustmentPosting');

// Lo que el trabajo recibe ya bloqueado: las existencias que el ajuste toca (vacias si el
// articulo nunca estuvo en esa bodega) y los movimientos que el ajuste ya escribio.
export interface Ledger {
  stock(itemId: ItemRef, warehouseId: WarehouseRef): ItemStock;
  movementsOf(adjustmentId: AdjustmentId): InventoryMovement[];
}

export interface Posting {
  adjustment: Adjustment;
  stocks: ItemStock[];
  movements: InventoryMovement[];
}

// El unico camino para mover existencia. Bloquea el ajuste y sus existencias, ejecuta el
// trabajo con ellos y guarda ajuste, movimientos y existencias en una sola transaccion.
// Dos confirmaciones a la vez del mismo ajuste, o dos salidas del mismo articulo, se
// ejecutan una detras de otra y la segunda ve lo que dejo la primera.
//
// `work` es sincrono y puro: si lanza un error de dominio, no se escribe nada.
export interface AdjustmentPosting {
  post(tenantId: TenantId, adjustmentId: AdjustmentId, work: (adjustment: Adjustment, ledger: Ledger) => Posting): Promise<void>;
}
