import { Injectable } from '@nestjs/common';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PurchaseReturnNotEditableError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseReturn, PurchaseReturnId } from '../../domain/return/purchase-return.entity.js';
import { PurchaseReturnCriteria, PurchaseReturnRepository } from '../../domain/return/purchase-return.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, PURCHASE_RETURN_INCLUDE, purchaseReturnFromRow } from './purchasing-rows.js';

@Injectable()
export class PrismaPurchaseReturnRepository implements PurchaseReturnRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(returnEntity: PurchaseReturn): Promise<void> {
    const { lines, returnDate, ...row } = returnEntity.toPrimitives();

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.purchaseReturn.findFirst({
        where: { tenantId: row.tenantId, id: row.id },
        select: { status: true },
      });

      if (!exists) {
        await tx.purchaseReturn.create({
          data: {
            ...row,
            returnDate: asDate(returnDate),
          },
        });
      } else {
        const { count } = await tx.purchaseReturn.updateMany({
          where: {
            tenantId: row.tenantId,
            id: row.id,
            status: 'draft',
            updatedAt: returnEntity.version() ?? undefined,
          },
          data: {
            returnDate: asDate(returnDate),
            reason: row.reason,
            notes: row.notes,
            updatedAt: row.updatedAt,
          },
        });

        if (count === 0) {
          if (exists.status !== 'draft') throw new PurchaseReturnNotEditableError(row.id, exists.status);
          throw new ConcurrentModificationError(row.id);
        }

        await tx.purchaseReturnLine.deleteMany({
          where: { tenantId: row.tenantId, purchaseReturnId: row.id },
        });
      }

      await tx.purchaseReturnLine.createMany({
        data: lines.map((line) => ({
          ...line,
          tenantId: row.tenantId,
          purchaseReturnId: row.id,
        })),
      });
    });
  }

  async find(tenantId: TenantId, id: PurchaseReturnId): Promise<PurchaseReturn | null> {
    const row = await this.prisma.purchaseReturn.findFirst({
      where: { tenantId: tenantId.value, id: id.value },
      include: PURCHASE_RETURN_INCLUDE,
    });

    return row ? purchaseReturnFromRow(row) : null;
  }

  async searchPage(tenantId: TenantId, criteria: PurchaseReturnCriteria): Promise<{ returns: PurchaseReturn[]; total: number }> {
    const text = criteria.text;
    const where = {
      tenantId: tenantId.value,
      ...(criteria.supplierId ? { supplierId: criteria.supplierId } : {}),
      ...(criteria.receiptId ? { receiptId: criteria.receiptId } : {}),
      ...(criteria.status ? { status: criteria.status } : {}),
      ...(criteria.from || criteria.to
        ? {
            returnDate: {
              ...(criteria.from ? { gte: new Date(`${criteria.from}T00:00:00.000Z`) } : {}),
              ...(criteria.to ? { lte: new Date(`${criteria.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
      ...(text
        ? {
            OR: [
              { code: { contains: text, mode: 'insensitive' as const } },
              { reason: { contains: text, mode: 'insensitive' as const } },
              { receipt: { code: { contains: text, mode: 'insensitive' as const } } },
              { supplier: { name: { contains: text, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.purchaseReturn.findMany({
        where,
        include: PURCHASE_RETURN_INCLUDE,
        orderBy: { code: 'desc' },
        take: criteria.limit,
        skip: criteria.offset,
      }),
      this.prisma.purchaseReturn.count({ where }),
    ]);

    return { returns: rows.map(purchaseReturnFromRow), total };
  }

  async returnedQuantitiesByReceipt(tenantId: TenantId, receiptId: string, excludeReturnId?: string): Promise<Map<string, number>> {
    const rows = await this.prisma.purchaseReturnLine.findMany({
      where: {
        tenantId: tenantId.value,
        purchaseReturn: {
          tenantId: tenantId.value,
          receiptId,
          status: 'confirmed',
          ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
        },
      },
      select: {
        receiptLineId: true,
        quantity: true,
      },
    });

    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.receiptLineId, (map.get(r.receiptLineId) ?? 0) + Number(r.quantity));
    }
    return map;
  }
}
