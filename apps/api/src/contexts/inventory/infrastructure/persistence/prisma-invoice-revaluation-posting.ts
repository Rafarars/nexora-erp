import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  INVOICE_REVALUATION_POSTING,
  InvoiceRevaluationPosting,
  InvoiceWarehouseRevaluationData,
} from '../../../purchasing/domain/invoice/invoice-revaluation-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { Adjustment, AdjustmentId } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentDate } from '../../domain/adjustment/adjustment-date.vo.js';
import { AdjustmentLine, AdjustmentLineId } from '../../domain/adjustment/adjustment-line.js';
import { ItemRef, UnitRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { Quantity } from '../../domain/quantity/quantity.vo.js';
import {
  INVENTORY_CODE_SEQUENCE,
  documentCode,
} from '../../domain/shared/code-sequence.js';
import type { InventoryCodeSequence } from '../../domain/shared/code-sequence.js';

@Injectable()
export class PrismaInvoiceRevaluationPosting implements InvoiceRevaluationPosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INVENTORY_CODE_SEQUENCE) private readonly codes: InventoryCodeSequence,
  ) {}

  async createDraftRevaluations(
    tenantId: TenantId,
    invoiceId: string,
    invoiceCode: string,
    invoiceDate: string,
    revaluations: InvoiceWarehouseRevaluationData[],
    now: Date,
    today: string,
    userId?: string | null,
    context?: unknown,
    originTypeParam: 'purchase_invoice' | 'supplier_credit_note' = 'purchase_invoice',
  ): Promise<void> {
    const client = (context as TransactionClient) ?? this.prisma;
    const tenant = tenantId.value;

    for (const rev of revaluations) {
      if (rev.lines.length === 0) continue;

      const netAmount = rev.lines.reduce((sum, l) => sum + l.amount, 0);
      // H9 §4.1: Si la diferencia neta para una bodega es cero, no se crea ajuste para esa bodega.
      if (Math.abs(netAmount) < 0.0001) continue;

      const seq = await this.codes.next(tenantId, 'AJU');
      const code = documentCode('AJU', seq);
      const adjustmentId = randomUUID();

      const lines = rev.lines.map((l) =>
        AdjustmentLine.of({
          id: AdjustmentLineId.of(randomUUID()),
          lineNumber: l.lineNumber,
          itemId: ItemRef.of(l.itemId),
          itemSku: l.itemSku,
          itemName: l.itemName,
          unitId: UnitRef.of(l.unitId),
          direction: l.amount >= 0 ? 'in' : 'out',
          quantity: Quantity.of(0),
          baseQuantity: Quantity.of(0),
          unitCost: null,
          revaluationKind: 'amount',
          amount: l.amount,
          sourceMovementId: l.sourceMovementId,
        }),
      );

      const noteText =
        originTypeParam === 'supplier_credit_note'
          ? `Diferencia de precio segun nota de credito ${invoiceCode}`
          : `Diferencia de precio segun factura ${invoiceCode}`;

      const adjustment = Adjustment.draft(
        AdjustmentId.of(adjustmentId),
        tenantId,
        code,
        {
          warehouseId: WarehouseRef.of(rev.warehouseId),
          date: AdjustmentDate.of(invoiceDate), // H9 Defecto 1.4: Lleva la fecha de la factura
          type: 'revaluation',
          notes: noteText,
          originType: originTypeParam,
          originId: invoiceId,
          lines,
        },
        now,
        today,
        userId ?? null, // H9 Defecto 1.3: Autor que confirmó la factura
      );

      const prim = adjustment.toPrimitives();

      await client.adjustment.create({
        data: {
          id: prim.id,
          tenantId: prim.tenantId,
          code: prim.code,
          warehouseId: prim.warehouseId,
          adjustmentDate: new Date(`${prim.adjustmentDate}T00:00:00.000Z`),
          type: prim.type,
          notes: prim.notes,
          status: prim.status,
          createdBy: prim.createdBy,
          originType: prim.originType,
          originId: prim.originId,
          createdAt: prim.createdAt,
          updatedAt: prim.updatedAt,
        },
      });

      await client.adjustmentLine.createMany({
        data: prim.lines.map((line) => ({
          id: line.id,
          tenantId: prim.tenantId,
          adjustmentId: prim.id,
          lineNumber: line.lineNumber,
          itemId: line.itemId,
          itemSku: line.itemSku,
          itemName: line.itemName,
          unitId: line.unitId,
          direction: line.direction,
          quantity: line.quantity,
          baseQuantity: line.baseQuantity,
          unitCost: line.unitCost,
          revaluationKind: line.revaluationKind,
          amount: line.amount,
          sourceMovementId: line.sourceMovementId,
        })),
      });
    }
  }

  async cancelOrReverseRevaluations(
    tenantId: TenantId,
    invoiceId: string,
    invoiceCode: string,
    now: Date,
    today: string,
    userId?: string | null,
    context?: unknown,
    originTypeParam: 'purchase_invoice' | 'supplier_credit_note' = 'purchase_invoice',
  ): Promise<void> {
    const client = (context as TransactionClient) ?? this.prisma;
    const tenant = tenantId.value;

    const existing = await client.adjustment.findMany({
      where: {
        tenantId: tenant,
        originType: originTypeParam,
        originId: invoiceId,
      },
      include: {
        lines: true,
      },
    });

    for (const adj of existing) {
      if (adj.status === 'draft') {
        // H9 §4.1: Si el ajuste de revaluacion asociado sigue en borrador, se anula automaticamente.
        await client.adjustment.update({
          where: { tenantId_id: { tenantId: tenant, id: adj.id } },
          data: {
            status: 'cancelled',
            cancelledAt: now,
            cancelledBy: userId ?? null,
            updatedAt: now,
          },
        });
      } else if (adj.status === 'confirmed') {
        // H9 §4.1: Si ya fue confirmado, se crea un ajuste inverso de revaluacion en borrador (con signo contrario).
        const seq = await this.codes.next(tenantId, 'AJU');
        const code = documentCode('AJU', seq);
        const reverseId = randomUUID();

        const reverseLines = adj.lines.map((l) => {
          const invertedAmount = Number(l.amount) * -1;
          return AdjustmentLine.of({
            id: AdjustmentLineId.of(randomUUID()),
            lineNumber: l.lineNumber,
            itemId: ItemRef.of(l.itemId),
            itemSku: l.itemSku,
            itemName: l.itemName,
            unitId: UnitRef.of(l.unitId),
            direction: invertedAmount >= 0 ? 'in' : 'out',
            quantity: Quantity.of(0),
            baseQuantity: Quantity.of(0),
            unitCost: null,
            revaluationKind: 'amount',
            amount: invertedAmount,
            sourceMovementId: l.sourceMovementId,
          });
        });

        const noteText =
          originTypeParam === 'supplier_credit_note'
            ? `Ajuste inverso de revaluacion por anulacion de nota de credito ${invoiceCode}`
            : `Ajuste inverso de revaluacion por anulacion de factura ${invoiceCode}`;

        const reverseAdjustment = Adjustment.draft(
          AdjustmentId.of(reverseId),
          tenantId,
          code,
          {
            warehouseId: WarehouseRef.of(adj.warehouseId),
            date: AdjustmentDate.of(today), // H9 Defecto 1.4: Lleva la fecha de hoy de la empresa al anular
            type: 'revaluation',
            notes: noteText,
            originType: originTypeParam,
            originId: invoiceId,
            lines: reverseLines,
          },
          now,
          today,
          userId ?? null,
        );

        const prim = reverseAdjustment.toPrimitives();

        await client.adjustment.create({
          data: {
            id: prim.id,
            tenantId: prim.tenantId,
            code: prim.code,
            warehouseId: prim.warehouseId,
            adjustmentDate: new Date(`${prim.adjustmentDate}T00:00:00.000Z`),
            type: prim.type,
            notes: prim.notes,
            status: prim.status,
            createdBy: prim.createdBy,
            originType: prim.originType,
            originId: prim.originId,
            createdAt: prim.createdAt,
            updatedAt: prim.updatedAt,
          },
        });

        await client.adjustmentLine.createMany({
          data: prim.lines.map((line) => ({
            id: line.id,
            tenantId: prim.tenantId,
            adjustmentId: prim.id,
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            itemSku: line.itemSku,
            itemName: line.itemName,
            unitId: line.unitId,
            direction: line.direction,
            quantity: line.quantity,
            baseQuantity: line.baseQuantity,
            unitCost: line.unitCost,
            revaluationKind: line.revaluationKind,
            amount: line.amount,
            sourceMovementId: line.sourceMovementId,
          })),
        });
      }
    }
  }
}
