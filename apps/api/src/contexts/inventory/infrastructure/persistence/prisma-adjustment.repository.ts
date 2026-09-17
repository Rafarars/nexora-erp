import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { Adjustment, AdjustmentId } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { AdjustmentNotEditableError } from '../../domain/errors/inventory.errors.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { adjustmentFromRow } from './inventory-rows.js';

@Injectable()
export class PrismaAdjustmentRepository implements AdjustmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Un borrador y sus lineas en una transaccion. La actualizacion solo alcanza filas que
  // SIGUEN en borrador: si otra peticion lo confirmo entre la lectura y esta escritura, no
  // se devuelve a borrador en silencio, se rechaza.
  async save(adjustment: Adjustment): Promise<void> {
    const { lines, adjustmentDate, ...row } = adjustment.toPrimitives();
    const date = new Date(`${adjustmentDate}T00:00:00.000Z`);

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.adjustment.findFirst({ where: { tenantId: row.tenantId, id: row.id }, select: { status: true } });

      if (!exists) {
        await tx.adjustment.create({ data: { ...row, adjustmentDate: date } });
      } else {
        const { count } = await tx.adjustment.updateMany({
          where: { tenantId: row.tenantId, id: row.id, status: 'draft', updatedAt: adjustment.version() ?? undefined },
          data: { warehouseId: row.warehouseId, adjustmentDate: date, notes: row.notes, updatedAt: row.updatedAt },
        });

        if (count === 0) {
          if (exists.status !== 'draft') throw new AdjustmentNotEditableError(row.id, exists.status);
          throw new ConcurrentModificationError(row.id);
        }

        await tx.adjustmentLine.deleteMany({ where: { tenantId: row.tenantId, adjustmentId: row.id } });
      }

      await tx.adjustmentLine.createMany({
        data: lines.map((line) => ({ ...line, tenantId: row.tenantId, adjustmentId: row.id })),
      });
    });
  }

  async find(tenantId: TenantId, id: AdjustmentId): Promise<Adjustment | null> {
    const row = await this.prisma.adjustment.findFirst({
      where: { tenantId: tenantId.value, id: id.value },
      include: { lines: true },
    });

    return row ? adjustmentFromRow(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Adjustment[]> {
    const rows = await this.prisma.adjustment.findMany({
      where: { tenantId: tenantId.value },
      include: { lines: true },
      orderBy: { code: 'desc' },
    });

    return rows.map(adjustmentFromRow);
  }
}
