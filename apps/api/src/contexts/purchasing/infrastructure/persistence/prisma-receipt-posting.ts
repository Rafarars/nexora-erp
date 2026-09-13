import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_STOCK_POSTING } from '../../../../shared/prisma/document-stock-posting.js';
import type { DocumentStockPosting } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { GoodsReceiptNotFoundError, ReceivedGoodsAlreadyUsedError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrder } from '../../domain/order/purchase-order.entity.js';
import { ReceiptPosting, ReceiptPostingResult } from '../../domain/receipt/posting/receipt-posting.js';
import { GoodsReceipt, GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { receiptFromRow } from './purchasing-rows.js';
import { lockOrder, writeOrderState } from './prisma-order-writer.js';

// Todo en una transaccion y siempre en el mismo orden de bloqueo: la entrada, su orden y,
// dentro del inventario, las existencias. Un ajuste bloquea su documento y luego las
// existencias; nadie bloquea una orden despues de una existencia, asi que no hay ciclos.
@Injectable()
export class PrismaReceiptPosting implements ReceiptPosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_STOCK_POSTING) private readonly stock: DocumentStockPosting,
  ) {}

  async post(
    tenantId: TenantId,
    receiptId: GoodsReceiptId,
    work: (receipt: GoodsReceipt, order: PurchaseOrder) => ReceiptPostingResult,
  ): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ order_id: string }[]>`
        SELECT order_id FROM goods_receipts WHERE tenant_id = ${tenant}::uuid AND id = ${receiptId.value}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new GoodsReceiptNotFoundError(receiptId.value);

      const order = await lockOrder(tx, tenant, locked[0].order_id);
      const receipt = receiptFromRow(
        await tx.goodsReceipt.findFirstOrThrow({ where: { tenantId: tenant, id: receiptId.value }, include: { lines: true } }),
      );

      const result = work(receipt, order);
      const header = result.receipt.toPrimitives();
      const now = header.updatedAt;

      await tx.goodsReceipt.update({
        where: { tenantId_id: { tenantId: tenant, id: header.id } },
        data: { status: header.status, confirmedAt: header.confirmedAt, cancelledAt: header.cancelledAt, updatedAt: header.updatedAt },
      });
      await writeOrderState(tx, result.order);

      const document = { type: 'receipt' as const, id: header.id };

      if (result.stock.kind === 'receive') {
        await this.stock.receive(
          tx,
          tenant,
          document,
          result.stock.entries.map((entry) => ({
            lineId: entry.lineId,
            itemId: entry.itemId.value,
            warehouseId: entry.warehouseId.value,
            quantity: entry.quantity.toNumber(),
            unitCost: entry.unitCost.toNumber(),
          })),
          now,
        );
      } else if (result.stock.kind === 'reverse') {
        try {
          await this.stock.reverse(tx, tenant, document, now);
        } catch (error) {
          // Capa anticorrupcion: el inventario habla de existencia insuficiente; compras,
          // de mercancia de esta entrada que ya salio.
          if (error instanceof Error && error.name === 'InsufficientStockError') {
            throw new ReceivedGoodsAlreadyUsedError(header.id);
          }

          throw error;
        }
      }
    });
  }
}
