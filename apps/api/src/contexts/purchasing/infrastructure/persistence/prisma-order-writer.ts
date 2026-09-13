import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { PurchaseOrderNotFoundError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrder } from '../../domain/order/purchase-order.entity.js';
import { orderFromRow } from './purchasing-rows.js';

// Lo que comparten las dos publicaciones de compras: bloquear una orden y escribir su
// estado y lo recibido de cada linea.
export async function lockOrder(tx: TransactionClient, tenantId: string, orderId: string): Promise<PurchaseOrder> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM purchase_orders WHERE tenant_id = ${tenantId}::uuid AND id = ${orderId}::uuid FOR UPDATE`;

  if (locked.length === 0) throw new PurchaseOrderNotFoundError(orderId);

  return orderFromRow(await tx.purchaseOrder.findFirstOrThrow({ where: { tenantId, id: orderId }, include: { lines: true } }));
}

export async function writeOrderState(tx: TransactionClient, order: PurchaseOrder): Promise<void> {
  const { tenantId, id, status, confirmedAt, cancelledAt, updatedAt, lines } = order.toPrimitives();

  await tx.purchaseOrder.update({ where: { tenantId_id: { tenantId, id } }, data: { status, confirmedAt, cancelledAt, updatedAt } });

  for (const line of lines) {
    await tx.purchaseOrderLine.update({ where: { tenantId_id: { tenantId, id: line.id } }, data: { receivedQuantity: line.receivedQuantity } });
  }
}
