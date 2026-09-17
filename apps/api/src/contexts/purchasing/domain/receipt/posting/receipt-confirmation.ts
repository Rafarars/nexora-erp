import { PurchaseOrder } from '../../order/purchase-order.entity.js';
import { UnitCost } from '../../shared/money.js';
import { GoodsReceipt } from '../goods-receipt.entity.js';
import { ReceiptPostingResult } from './receipt-posting.js';

// Confirmar: la orden registra lo recibido (y rechaza lo que supere lo pendiente) y el
// inventario recibe cada linea en la bodega de la orden, a su costo por unidad base llevado a la
// moneda de la empresa con las tasas de la entrada.
export class ReceiptConfirmation {
  apply(receipt: GoodsReceipt, order: PurchaseOrder, now: Date): ReceiptPostingResult {
    receipt.confirm(now);
    order.registerReceipt(
      receipt.lines().map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity })),
      now,
    );

    return {
      receipt,
      order,
      stock: {
        kind: 'receive',
        entries: receipt.lines().map((line) => ({
          lineId: line.id.value,
          itemId: line.itemId,
          warehouseId: receipt.warehouseId,
          quantity: line.baseQuantity,
          unitCost: UnitCost.ofMicros(receipt.currency().toBase(line.baseUnitCost().micros)),
        })),
      },
    };
  }
}
