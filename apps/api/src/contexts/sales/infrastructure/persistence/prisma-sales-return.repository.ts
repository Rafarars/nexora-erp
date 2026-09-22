import { Injectable } from '@nestjs/common';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SalesReturnNotEditableError } from '../../domain/errors/sales.errors.js';
import { SalesReturn, SalesReturnId } from '../../domain/return/sales-return.entity.js';
import { SalesReturnCriteria, SalesReturnRepository } from '../../domain/return/sales-return.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, salesReturnFromRow } from './sales-rows.js';

@Injectable()
export class PrismaSalesReturnRepository implements SalesReturnRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(returnEntity: SalesReturn): Promise<void> {
    const { lines, returnDate, ...row } = returnEntity.toPrimitives();

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.salesReturn.findFirst({
        where: { tenantId: row.tenantId, id: row.id },
        select: { status: true },
      });

      if (!exists) {
        await tx.salesReturn.create({
          data: {
            ...row,
            returnDate: asDate(returnDate),
          },
        });
      } else {
        const { count } = await tx.salesReturn.updateMany({
          where: {
            tenantId: row.tenantId,
            id: row.id,
            status: 'draft',
            updatedAt: returnEntity.version() ?? undefined,
          },
          data: {
            returnDate: asDate(returnDate),
            condition: row.condition,
            reason: row.reason,
            notes: row.notes,
            updatedAt: row.updatedAt,
          },
        });

        if (count === 0) {
          if (exists.status !== 'draft') throw new SalesReturnNotEditableError(row.id, exists.status);
          throw new ConcurrentModificationError(row.id);
        }

        await tx.salesReturnLine.deleteMany({
          where: { tenantId: row.tenantId, salesReturnId: row.id },
        });
      }

      await tx.salesReturnLine.createMany({
        data: lines.map((line) => ({
          ...line,
          tenantId: row.tenantId,
          salesReturnId: row.id,
        })),
      });
    });
  }

  async find(tenantId: TenantId, id: SalesReturnId): Promise<SalesReturn | null> {
    const row = await this.prisma.salesReturn.findFirst({
      where: { tenantId: tenantId.value, id: id.value },
      include: { lines: true },
    });

    return row ? salesReturnFromRow(row) : null;
  }

  async searchPage(tenantId: TenantId, criteria: SalesReturnCriteria): Promise<{ returns: SalesReturn[]; total: number }> {
    const text = criteria.text;
    const where = {
      tenantId: tenantId.value,
      ...(criteria.customerId ? { customerId: criteria.customerId } : {}),
      ...(criteria.dispatchId ? { dispatchId: criteria.dispatchId } : {}),
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
              { dispatch: { code: { contains: text, mode: 'insensitive' as const } } },
              { customer: { name: { contains: text, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.salesReturn.findMany({
        where,
        include: { lines: true },
        orderBy: { code: 'desc' },
        take: criteria.limit,
        skip: criteria.offset,
      }),
      this.prisma.salesReturn.count({ where }),
    ]);

    return { returns: rows.map(salesReturnFromRow), total };
  }

  async returnedQuantitiesByDispatch(tenantId: TenantId, dispatchId: string, excludeReturnId?: string): Promise<Map<string, number>> {
    const rows = await this.prisma.salesReturnLine.findMany({
      where: {
        tenantId: tenantId.value,
        dispatchLineId: { not: null },
        return: {
          tenantId: tenantId.value,
          dispatchId,
          status: 'confirmed',
          ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
        },
      },
      select: {
        dispatchLineId: true,
        quantity: true,
      },
    });

    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.dispatchLineId) {
        map.set(r.dispatchLineId, (map.get(r.dispatchLineId) ?? 0) + Number(r.quantity));
      }
    }
    return map;
  }
}
