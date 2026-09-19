import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { GoodsReceiptNotEditableError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { GoodsReceipt, GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptCriteria, GoodsReceiptPage, GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
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
          where: { tenantId: row.tenantId, id: row.id, status: 'draft', updatedAt: receipt.version() ?? undefined },
          data: {
            receiptDate: asDate(receiptDate),
            notes: row.notes,
            exchangeRate: row.exchangeRate,
            baseCurrency: row.baseCurrency,
            baseExchangeRate: row.baseExchangeRate,
            manualExchangeRate: row.manualExchangeRate,
            updatedAt: row.updatedAt,
          },
        });

        if (count === 0) {
          if (exists.status !== 'draft') throw new GoodsReceiptNotEditableError(row.id, exists.status);
          throw new ConcurrentModificationError(row.id);
        }

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

  async searchPage(tenantId: TenantId, criteria: GoodsReceiptCriteria): Promise<GoodsReceiptPage> {
    const text = criteria.text;
    const where = {
      tenantId: tenantId.value,
      ...(criteria.orderId ? { orderId: criteria.orderId } : {}),
      ...(criteria.warehouseId ? { warehouseId: criteria.warehouseId } : {}),
      ...(criteria.status ? { status: criteria.status } : {}),
      ...(criteria.from || criteria.to
        ? {
            receiptDate: {
              ...(criteria.from ? { gte: new Date(`${criteria.from}T00:00:00.000Z`) } : {}),
              ...(criteria.to ? { lte: new Date(`${criteria.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
      ...(text
        ? {
            OR: [
              { code: { contains: text, mode: 'insensitive' as const } },
              { order: { code: { contains: text, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.goodsReceipt.findMany({ where, include: { lines: true }, orderBy: { code: 'desc' }, take: criteria.limit, skip: criteria.offset }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    return { receipts: rows.map(receiptFromRow), total };
  }
}
