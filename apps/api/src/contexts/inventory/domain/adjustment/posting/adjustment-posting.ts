import { InventoryMovement } from '../../movement/inventory-movement.entity.js';
import { Ledger } from '../../stock/posting/stock-ledger.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { ItemStock } from '../../stock/item-stock.entity.js';
import { Adjustment, AdjustmentId } from '../adjustment.entity.js';

export const ADJUSTMENT_POSTING = Symbol('AdjustmentPosting');

export type { Ledger } from '../../stock/posting/stock-ledger.js';

export interface Posting {
  adjustment: Adjustment;
  stocks: ItemStock[];
  movements: InventoryMovement[];
}

// Publica un ajuste. Bloquea el ajuste y sus existencias, ejecuta el trabajo con ellos y
// guarda ajuste, movimientos y existencias en una sola transaccion. Dos confirmaciones a
// la vez del mismo ajuste, o dos salidas del mismo articulo, se ejecutan una detras de otra
// y la segunda ve lo que dejo la primera.
//
// `work` es sincrono y puro: si lanza un error de dominio, no se escribe nada. Las entradas
// de mercancia usan el mismo bloqueo y la misma escritura de existencias por
// DocumentStockPosting.
export interface AdjustmentPosting {
  post(tenantId: TenantId, adjustmentId: AdjustmentId, work: (adjustment: Adjustment, ledger: Ledger) => Posting): Promise<void>;
}
