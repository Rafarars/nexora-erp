import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { GoodsReceiptNotEditableError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { GoodsReceipt, GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, receiptFromRow } from './purchasing-rows.js';

@Injectable()
export class PrismaGoodsReceiptRepository implements GoodsReceiptRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Como la orden: un borrador que otra peticion confirmo no se pisa.
  async save(receipt: GoodsReceipt): Promise<void> {
    const { lines, receiptDate, ...row } = receipt.toPrimitives();

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.goodsReceipt.findFirst({ where: { tenantId: row.tenantId, id: row.id }, select: { status: true } });

      if (!exists) {
        await tx.goodsReceipt.create({ data: { ...row, receiptDate: asDate(receiptDate) } });
      } else {
        const { count } = await tx.goodsReceipt.updateMany({
          where: { tenantId: row.tenantId, id: row.id, status: 'draft' },
          data: { receiptDate: asDate(receiptDate), notes: row.notes, updatedAt: row.updatedAt },
        });

        if (count === 0) throw new GoodsReceiptNotEditableError(row.id, exists.status);

        await tx.goodsReceiptLine.deleteMany({ where: { tenantId: row.tenantId, receiptId: row.id } });
      }

      await tx.goodsReceiptLine.createMany({
        data: lines.map((line) => ({ ...line, tenantId: row.tenantId, receiptId: row.id })),
      });
    });
  }

  async find(tenantId: TenantId, id: GoodsReceiptId): Promise<GoodsReceipt | null> {
    const row = await this.prisma.goodsReceipt.findFirst({ where: { tenantId: tenantId.value, id: id.value }, include: { lines: true } });

    return row ? receiptFromRow(row) : null;
  }

  async searchByTenant(tenantId: TenantId, orderId?: PurchaseOrderId): Promise<GoodsReceipt[]> {
    const rows = await this.prisma.goodsReceipt.findMany({
      where: { tenantId: tenantId.value, ...(orderId ? { orderId: orderId.value } : {}) },
      include: { lines: true },
      orderBy: { code: 'desc' },
    });

    return rows.map(receiptFromRow);
  }
}
