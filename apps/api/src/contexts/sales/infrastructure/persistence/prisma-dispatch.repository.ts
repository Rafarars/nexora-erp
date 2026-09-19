import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { Dispatch, DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchCriteria, DispatchPage, DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { DispatchNotEditableError } from '../../domain/errors/sales.errors.js';
import { SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, dispatchFromRow } from './sales-rows.js';

@Injectable()
export class PrismaDispatchRepository implements DispatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(dispatch: Dispatch): Promise<void> {
    const { lines, dispatchDate, ...row } = dispatch.toPrimitives();

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.dispatch.findFirst({ where: { tenantId: row.tenantId, id: row.id }, select: { status: true } });

      if (!exists) {
        await tx.dispatch.create({ data: { ...row, dispatchDate: asDate(dispatchDate) } });
      } else {
        const { count } = await tx.dispatch.updateMany({
          where: { tenantId: row.tenantId, id: row.id, status: 'draft', updatedAt: dispatch.version() ?? undefined },
          data: { dispatchDate: asDate(dispatchDate), notes: row.notes, updatedAt: row.updatedAt },
        });

        if (count === 0) {
          if (exists.status !== 'draft') throw new DispatchNotEditableError(row.id, exists.status);
          throw new ConcurrentModificationError(row.id);
        }

        await tx.dispatchLine.deleteMany({ where: { tenantId: row.tenantId, dispatchId: row.id } });
      }

      await tx.dispatchLine.createMany({ data: lines.map((line) => ({ ...line, tenantId: row.tenantId, dispatchId: row.id })) });
    });
  }

  async find(tenantId: TenantId, id: DispatchId): Promise<Dispatch | null> {
    const row = await this.prisma.dispatch.findFirst({ where: { tenantId: tenantId.value, id: id.value }, include: { lines: true } });

    return row ? dispatchFromRow(row) : null;
  }

  async searchByTenant(tenantId: TenantId, orderId?: SalesOrderId): Promise<Dispatch[]> {
    const rows = await this.prisma.dispatch.findMany({
      where: { tenantId: tenantId.value, ...(orderId ? { orderId: orderId.value } : {}) },
      include: { lines: true },
      orderBy: { code: 'desc' },
    });

    return rows.map(dispatchFromRow);
  }

  async searchPage(tenantId: TenantId, criteria: DispatchCriteria): Promise<DispatchPage> {
    const text = criteria.text;
    const where = {
      tenantId: tenantId.value,
      ...(criteria.orderId ? { orderId: criteria.orderId } : {}),
      ...(criteria.warehouseId ? { warehouseId: criteria.warehouseId } : {}),
      ...(criteria.status ? { status: criteria.status } : {}),
      ...(criteria.from || criteria.to
        ? {
            dispatchDate: {
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
      this.prisma.dispatch.findMany({ where, include: { lines: true }, orderBy: { code: 'desc' }, take: criteria.limit, skip: criteria.offset }),
      this.prisma.dispatch.count({ where }),
    ]);

    return { dispatches: rows.map(dispatchFromRow), total };
  }
}
