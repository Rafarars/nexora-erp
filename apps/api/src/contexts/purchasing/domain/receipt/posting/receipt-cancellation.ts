import { PurchaseOrder } from '../../order/purchase-order.entity.js';
import { GoodsReceipt } from '../goods-receipt.entity.js';
import { ReceiptPostingResult } from './receipt-posting.js';

// Anular: un borrador solo cambia de estado. Una confirmada devuelve a la orden lo que le
// habia registrado, y la orden retrocede de estado; el inventario revierte la existencia.
export class ReceiptCancellation {
  apply(receipt: GoodsReceipt, order: PurchaseOrder, now: Date): ReceiptPostingResult {
    const wasConfirmed = receipt.currentStatus() === 'confirmed';

    receipt.cancel(now);

    if (!wasConfirmed) return { receipt, order, stock: { kind: 'none' } };

    order.revertReceipt(
      receipt.lines().map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity })),
      now,
    );

    return { receipt, order, stock: { kind: 'reverse' } };
  }
}
