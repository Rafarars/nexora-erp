import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { Adjustment, AdjustmentId } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentPosting, Ledger, Posting } from '../../domain/adjustment/posting/adjustment-posting.js';
import { AdjustmentNotFoundError } from '../../domain/errors/inventory.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { adjustmentFromRow } from './inventory-rows.js';
import { lockedLedger, movementsOf, writeChanges } from './prisma-stock-ledger.js';

// Todo ocurre en una transaccion:
//
// 1. Bloquea la fila del ajuste. Dos confirmaciones del mismo ajuste esperan en fila, y la
//    segunda lo lee ya confirmado.
// 2. Bloquea sus existencias en orden fijo (prisma-stock-ledger).
// 3. Ejecuta el trabajo del dominio. Si lanza, se revierte todo.
// 4. Escribe ajuste, movimientos y existencias.
@Injectable()
export class PrismaAdjustmentPosting implements AdjustmentPosting {
  constructor(private readonly prisma: PrismaService) {}

  async post(
    tenantId: TenantId,
    adjustmentId: AdjustmentId,
    work: (adjustment: Adjustment, ledger: Ledger) => Posting,
  ): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM adjustments WHERE tenant_id = ${tenant}::uuid AND id = ${adjustmentId.value}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new AdjustmentNotFoundError(adjustmentId.value);

      const adjustment = adjustmentFromRow(
        await tx.adjustment.findFirstOrThrow({ where: { tenantId: tenant, id: adjustmentId.value }, include: { lines: true } }),
      );
      const previous = await movementsOf(tx, tenant, 'adjustment', adjustmentId.value);
      const warehouseId = adjustment.warehouseId().value;
      const ledger = await lockedLedger(tx, tenant, [
        ...adjustment.lines().map((line): [string, string] => [line.itemId.value, warehouseId]),
        ...previous.map((movement): [string, string] => [movement.itemId.value, movement.warehouseId.value]),
      ], previous);

      const posting = work(adjustment, ledger);
      const header = posting.adjustment.toPrimitives();

      await tx.adjustment.update({
        where: { tenantId_id: { tenantId: tenant, id: header.id } },
        data: {
          status: header.status,
          confirmedAt: header.confirmedAt,
          confirmedBy: header.confirmedBy,
          cancelledAt: header.cancelledAt,
          cancelledBy: header.cancelledBy,
          updatedAt: header.updatedAt,
        },
      });

      await writeChanges(tx, tenant, posting);
    });
  }
}
