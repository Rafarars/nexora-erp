import { PurchaseOrder } from '../../order/purchase-order.entity.js';
import { UnitCost } from '../../shared/money.js';
import { Quantity } from '../../shared/quantity.vo.js';
import { ItemRef, WarehouseRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { GoodsReceipt, GoodsReceiptId } from '../goods-receipt.entity.js';

export const RECEIPT_POSTING = Symbol('ReceiptPosting');

// Una linea para el inventario, ya en unidad base y con su costo por unidad base.
export interface ReceiptStockEntry {
  lineId: string;
  itemId: ItemRef;
  warehouseId: WarehouseRef;
  quantity: Quantity;
  unitCost: UnitCost;
}

// Lo que el inventario tiene que hacer con la existencia: nada (un borrador descartado),
// registrar la entrada o revertir lo que la entrada escribio.
export type StockInstruction = { kind: 'none' } | { kind: 'receive'; entries: ReceiptStockEntry[] } | { kind: 'reverse' };

export interface ReceiptPostingResult {
  receipt: GoodsReceipt;
  order: PurchaseOrder;
  stock: StockInstruction;
}

// Confirma o anula una entrada en una sola transaccion: bloquea la entrada, luego su orden y
// luego las existencias; ejecuta el trabajo y escribe entrada, orden y existencia juntas.
// Dos entradas de la misma orden que se confirman a la vez esperan en fila, y la segunda ve
// lo que la primera ya recibio: entre las dos nunca entra mas de lo pedido.
//
// `work` es sincrono y puro. Si el inventario rechaza revertir porque la mercancia ya salio,
// lanza ReceivedGoodsAlreadyUsedError y no se escribe nada.
export interface ReceiptPosting {
  post(
    tenantId: TenantId,
    receiptId: GoodsReceiptId,
    work: (receipt: GoodsReceipt, order: PurchaseOrder) => ReceiptPostingResult,
  ): Promise<void>;
}
