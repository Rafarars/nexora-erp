import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  InvoiceRevaluationPosting,
  InvoiceWarehouseRevaluationData,
} from '../../domain/invoice/invoice-revaluation-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaInvoiceRevaluationPosting implements InvoiceRevaluationPosting {
  constructor(private readonly prisma: PrismaService) {}

  async createDraftRevaluations(
    tenantId: TenantId,
    invoiceId: string,
    invoiceCode: string,
    revaluations: InvoiceWarehouseRevaluationData[],
    now: Date,
    context?: unknown,
  ): Promise<void> {
    const client = (context as TransactionClient) ?? this.prisma;
    const tenant = tenantId.value;

    for (const rev of revaluations) {
      if (rev.lines.length === 0) continue;

      const netAmount = rev.lines.reduce((sum, l) => sum + l.amount, 0);
      // H9 §4.1: Si la diferencia neta para una bodega es cero, no se crea ajuste para esa bodega.
      if (Math.abs(netAmount) < 0.0001) continue;

      const [seqRow] = await client.$queryRaw<{ last_value: number }[]>`
        INSERT INTO code_sequences (tenant_id, prefix, last_value)
        VALUES (${tenant}::uuid, 'AJU', 1)
        ON CONFLICT (tenant_id, prefix)
        DO UPDATE SET last_value = code_sequences.last_value + 1
        RETURNING last_value`;

      const code = `AJU${String(seqRow.last_value).padStart(6, '0')}`;
      const adjustmentId = randomUUID();

      await client.adjustment.create({
        data: {
          id: adjustmentId,
          tenantId: tenant,
          code,
          warehouseId: rev.warehouseId,
          adjustmentDate: now,
          type: 'revaluation',
          notes: `Diferencia de precio segun factura ${invoiceCode}`,
          status: 'draft',
          originType: 'purchase_invoice',
          originId: invoiceId,
        },
      });

      await client.adjustmentLine.createMany({
        data: rev.lines.map((l) => ({
          id: randomUUID(),
          tenantId: tenant,
          adjustmentId,
          lineNumber: l.lineNumber,
          itemId: l.itemId,
          itemSku: l.itemSku,
          itemName: l.itemName,
          unitId: l.unitId,
          direction: l.amount >= 0 ? 'in' : 'out',
          quantity: 0,
          baseQuantity: 0,
          revaluationKind: 'amount',
          amount: l.amount,
          sourceMovementId: l.sourceMovementId,
        })),
      });
    }
  }

  async cancelOrReverseRevaluations(
    tenantId: TenantId,
    invoiceId: string,
    invoiceCode: string,
    now: Date,
    context?: unknown,
  ): Promise<void> {
    const client = (context as TransactionClient) ?? this.prisma;
    const tenant = tenantId.value;

    const existing = await client.adjustment.findMany({
      where: {
        tenantId: tenant,
        originType: 'purchase_invoice',
        originId: invoiceId,
      },
      include: {
        lines: true,
      },
    });

    for (const adj of existing) {
      if (adj.status === 'draft') {
        // H9 §4.1: Si el ajuste de revaluacion asociado sigue en borrador, se anula / descarta automaticamente.
        await client.adjustment.update({
          where: { tenantId_id: { tenantId: tenant, id: adj.id } },
          data: {
            status: 'cancelled',
            cancelledAt: now,
          },
        });
      } else if (adj.status === 'confirmed') {
        // H9 §4.1: Si ya fue confirmado, se crea un ajuste inverso de revaluacion en borrador (con signo contrario).
        const [seqRow] = await client.$queryRaw<{ last_value: number }[]>`
          INSERT INTO code_sequences (tenant_id, prefix, last_value)
          VALUES (${tenant}::uuid, 'AJU', 1)
          ON CONFLICT (tenant_id, prefix)
          DO UPDATE SET last_value = code_sequences.last_value + 1
          RETURNING last_value`;

        const code = `AJU${String(seqRow.last_value).padStart(6, '0')}`;
        const reverseId = randomUUID();

        await client.adjustment.create({
          data: {
            id: reverseId,
            tenantId: tenant,
            code,
            warehouseId: adj.warehouseId,
            adjustmentDate: now,
            type: 'revaluation',
            notes: `Ajuste inverso de revaluacion por anulacion de factura ${invoiceCode}`,
            status: 'draft',
            originType: 'purchase_invoice',
            originId: invoiceId,
          },
        });

        await client.adjustmentLine.createMany({
          data: adj.lines.map((l) => {
            const invertedAmount = Number(l.amount) * -1;
            return {
              id: randomUUID(),
              tenantId: tenant,
              adjustmentId: reverseId,
              lineNumber: l.lineNumber,
              itemId: l.itemId,
              itemSku: l.itemSku,
              itemName: l.itemName,
              unitId: l.unitId,
              direction: invertedAmount >= 0 ? 'in' : 'out',
              quantity: 0,
              baseQuantity: 0,
              revaluationKind: 'amount',
              amount: invertedAmount,
              sourceMovementId: l.sourceMovementId,
            };
          }),
        });
      }
    }
  }
}
