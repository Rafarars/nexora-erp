import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { DispatchNotFoundError, SalesOrderNotFoundError } from '../../domain/errors/sales.errors.js';
import { Dispatch } from '../../domain/dispatch/dispatch.entity.js';
import { SalesOrder } from '../../domain/order/sales-order.entity.js';
import { dispatchFromRow, orderFromRow } from './sales-rows.js';

// Lo que comparten las publicaciones de ventas: bloquear un pedido o un despacho y escribir su
// estado y lo despachado de cada linea.
export async function lockOrder(tx: TransactionClient, tenantId: string, orderId: string): Promise<SalesOrder> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM sales_orders WHERE tenant_id = ${tenantId}::uuid AND id = ${orderId}::uuid FOR UPDATE`;

  if (locked.length === 0) throw new SalesOrderNotFoundError(orderId);

  return orderFromRow(await tx.salesOrder.findFirstOrThrow({ where: { tenantId, id: orderId }, include: { lines: true } }));
}

export async function lockDispatch(tx: TransactionClient, tenantId: string, dispatchId: string): Promise<{ dispatch: Dispatch; invoiced: boolean }> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM dispatches WHERE tenant_id = ${tenantId}::uuid AND id = ${dispatchId}::uuid FOR UPDATE`;

  if (locked.length === 0) throw new DispatchNotFoundError(dispatchId);

  const [row, invoice] = await Promise.all([
    tx.dispatch.findFirstOrThrow({ where: { tenantId, id: dispatchId }, include: { lines: true } }),
    tx.invoice.findFirst({ where: { tenantId, dispatchId, status: 'issued' }, select: { id: true } }),
  ]);

  return { dispatch: dispatchFromRow(row), invoiced: invoice !== null };
}

export async function writeOrderState(tx: TransactionClient, order: SalesOrder): Promise<void> {
  const { tenantId, id, status, confirmedAt, cancelledAt, updatedAt, lines } = order.toPrimitives();

  await tx.salesOrder.update({ where: { tenantId_id: { tenantId, id } }, data: { status, confirmedAt, cancelledAt, updatedAt } });

  for (const line of lines) {
    await tx.salesOrderLine.update({ where: { tenantId_id: { tenantId, id: line.id } }, data: { dispatchedQuantity: line.dispatchedQuantity } });
  }
}

export async function writeDispatchState(tx: TransactionClient, dispatch: Dispatch): Promise<void> {
  const { tenantId, id, status, confirmedAt, cancelledAt, updatedAt } = dispatch.toPrimitives();

  await tx.dispatch.update({ where: { tenantId_id: { tenantId, id } }, data: { status, confirmedAt, cancelledAt, updatedAt } });
}
