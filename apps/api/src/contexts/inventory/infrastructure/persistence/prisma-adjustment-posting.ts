import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_ACCOUNTING_POSTING } from '../../../../shared/prisma/document-accounting-posting.js';
import type { DocumentAccountingPosting } from '../../../../shared/prisma/document-accounting-posting.js';
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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_ACCOUNTING_POSTING) private readonly accounting: DocumentAccountingPosting,
  ) {}

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
      const amountLines = adjustment
        .lines()
        .filter((line) => line.revaluationKind === 'amount' && line.sourceMovementId !== null)
        .map((line) => ({
          itemId: line.itemId.value,
          warehouseId,
          sourceMovementId: line.sourceMovementId!,
        }));
      const ledger = await lockedLedger(
        tx,
        tenant,
        [
          ...adjustment.lines().map((line): [string, string] => [line.itemId.value, warehouseId]),
          ...previous.map((movement): [string, string] => [movement.itemId.value, movement.warehouseId.value]),
        ],
        previous,
        amountLines,
      );

      const previousStatus = adjustment.currentStatus();
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

      for (const line of header.lines) {
        if (line.revaluationKind === 'amount') {
          await tx.adjustmentLine.update({
            where: { id: line.id },
            data: {
              stockPart: line.stockPart,
              soldPart: line.soldPart,
              unitCost: line.unitCost,
            },
          });
        }
      }

      await writeChanges(tx, tenant, posting);

      if (previousStatus === 'draft' && header.status === 'confirmed') {
        const isAmountRevaluation =
          header.originType !== null || header.lines.some((l) => l.revaluationKind === 'amount');

        if (isAmountRevaluation) {
          await this.accounting.post(tx, tenant, {
            kind: 'purchase-price-revalued',
            documentId: header.id,
            date: header.adjustmentDate,
            lines: header.lines.map((l) => ({
              itemId: l.itemId,
              split: {
                stockPart: l.stockPart ?? 0,
                soldPart: l.soldPart ?? 0,
              },
            })),
          });
        } else {
          const movements = posting.movements.map((m) => m.toPrimitives());
          const dir = (movements[0]?.direction ?? header.lines[0]?.direction ?? 'in') as 'in' | 'out';
          await this.accounting.post(tx, tenant, {
            kind: 'stock-adjusted',
            documentId: header.id,
            date: header.adjustmentDate,
            reason: header.type,
            origin: 'manual',
            direction: dir,
            lines: movements.map((m) => ({
              itemId: m.itemId,
              quantity: m.quantity,
              unitCost: m.unitCost,
              amount: Number((m.quantity * m.unitCost).toFixed(2)),
              direction: m.direction,
            })),
          });
        }
      } else if (previousStatus === 'confirmed' && header.status === 'cancelled') {
        const isAmountRevaluation =
          header.originType !== null || header.lines.some((l) => l.revaluationKind === 'amount');
        await this.accounting.post(tx, tenant, {
          kind: 'document-cancelled',
          originType: isAmountRevaluation ? 'price_revaluation' : 'inventory_adjustment',
          originId: header.id,
          date: header.cancelledAt ?? new Date(),
        });
      }
    });
  }
}
