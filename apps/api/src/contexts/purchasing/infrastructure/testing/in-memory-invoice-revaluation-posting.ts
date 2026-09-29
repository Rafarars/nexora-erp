import { randomUUID } from 'node:crypto';
import {
  InvoiceRevaluationPosting,
  InvoiceWarehouseRevaluationData,
} from '../../domain/invoice/invoice-revaluation-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface InMemoryStoredAdjustmentLine {
  id: string;
  lineNumber: number;
  itemId: string;
  itemSku: string;
  itemName: string;
  unitId: string;
  direction: 'in' | 'out';
  quantity: number;
  baseQuantity: number;
  revaluationKind: 'amount';
  amount: number;
  sourceMovementId: string;
}

export interface InMemoryStoredAdjustment {
  id: string;
  tenantId: string;
  code: string;
  warehouseId: string;
  adjustmentDate: Date;
  type: string;
  notes: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  originType: string;
  originId: string;
  cancelledAt?: Date | null;
  lines: InMemoryStoredAdjustmentLine[];
}

export class InMemoryInvoiceRevaluationPosting implements InvoiceRevaluationPosting {
  private seq = 0;
  readonly adjustments: InMemoryStoredAdjustment[] = [];

  async createDraftRevaluations(
    tenantId: TenantId,
    invoiceId: string,
    invoiceCode: string,
    revaluations: InvoiceWarehouseRevaluationData[],
    now: Date,
    _context?: unknown,
  ): Promise<void> {
    for (const rev of revaluations) {
      if (rev.lines.length === 0) continue;

      const netAmount = rev.lines.reduce((sum, l) => sum + l.amount, 0);
      if (Math.abs(netAmount) < 0.0001) continue;

      this.seq += 1;
      const code = `AJU${String(this.seq).padStart(6, '0')}`;
      const adjustmentId = randomUUID();

      this.adjustments.push({
        id: adjustmentId,
        tenantId: tenantId.value,
        code,
        warehouseId: rev.warehouseId,
        adjustmentDate: now,
        type: 'revaluation',
        notes: `Diferencia de precio segun factura ${invoiceCode}`,
        status: 'draft',
        originType: 'purchase_invoice',
        originId: invoiceId,
        lines: rev.lines.map((l) => ({
          id: randomUUID(),
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
    _context?: unknown,
  ): Promise<void> {
    const existing = this.adjustments.filter(
      (a) => a.tenantId === tenantId.value && a.originType === 'purchase_invoice' && a.originId === invoiceId,
    );

    for (const adj of existing) {
      if (adj.status === 'draft') {
        adj.status = 'cancelled';
        adj.cancelledAt = now;
      } else if (adj.status === 'confirmed') {
        this.seq += 1;
        const code = `AJU${String(this.seq).padStart(6, '0')}`;
        const reverseId = randomUUID();

        this.adjustments.push({
          id: reverseId,
          tenantId: tenantId.value,
          code,
          warehouseId: adj.warehouseId,
          adjustmentDate: now,
          type: 'revaluation',
          notes: `Ajuste inverso de revaluacion por anulacion de factura ${invoiceCode}`,
          status: 'draft',
          originType: 'purchase_invoice',
          originId: invoiceId,
          lines: adj.lines.map((l) => ({
            id: randomUUID(),
            lineNumber: l.lineNumber,
            itemId: l.itemId,
            itemSku: l.itemSku,
            itemName: l.itemName,
            unitId: l.unitId,
            direction: (l.amount * -1) >= 0 ? 'in' : 'out',
            quantity: 0,
            baseQuantity: 0,
            revaluationKind: 'amount',
            amount: l.amount * -1,
            sourceMovementId: l.sourceMovementId,
          })),
        });
      }
    }
  }
}
