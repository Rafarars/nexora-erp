import { randomUUID } from 'node:crypto';
import {
  InvoiceRevaluationPosting,
  InvoiceWarehouseRevaluationData,
  type TenantLike,
} from '../../../../shared/prisma/invoice-revaluation-posting.js';

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
    tenantId: TenantLike,
    invoiceId: string,
    invoiceCode: string,
    invoiceDate: string,
    revaluations: InvoiceWarehouseRevaluationData[],
    now: Date,
    today: string,
    userId?: string | null,
    _context?: unknown,
    originType: 'purchase_invoice' | 'supplier_credit_note' = 'purchase_invoice',
  ): Promise<void> {
    const tenant = typeof tenantId === 'string' ? tenantId : tenantId.value;
    for (const rev of revaluations) {
      if (rev.lines.length === 0) continue;

      const netAmount = rev.lines.reduce((sum: number, l) => sum + l.amount, 0);
      if (Math.abs(netAmount) < 0.0001) continue;

      this.seq += 1;
      const code = `AJU${String(this.seq).padStart(6, '0')}`;
      const adjustmentId = randomUUID();

      const noteText =
        originType === 'supplier_credit_note'
          ? `Diferencia de precio segun nota de credito ${invoiceCode}`
          : `Diferencia de precio segun factura ${invoiceCode}`;

      this.adjustments.push({
        id: adjustmentId,
        tenantId: tenant,
        code,
        warehouseId: rev.warehouseId,
        adjustmentDate: new Date(`${invoiceDate}T00:00:00.000Z`),
        type: 'revaluation',
        notes: noteText,
        status: 'draft',
        originType,
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
    tenantId: TenantLike,
    invoiceId: string,
    invoiceCode: string,
    now: Date,
    today: string,
    userId?: string | null,
    _context?: unknown,
    originType: 'purchase_invoice' | 'supplier_credit_note' = 'purchase_invoice',
  ): Promise<void> {
    const tenant = typeof tenantId === 'string' ? tenantId : tenantId.value;
    const existing = this.adjustments.filter(
      (a) => a.tenantId === tenant && a.originType === originType && a.originId === invoiceId,
    );

    for (const adj of existing) {
      if (adj.status === 'draft') {
        adj.status = 'cancelled';
        adj.cancelledAt = now;
      } else if (adj.status === 'confirmed') {
        this.seq += 1;
        const code = `AJU${String(this.seq).padStart(6, '0')}`;
        const reverseId = randomUUID();

        const noteText =
          originType === 'supplier_credit_note'
            ? `Ajuste inverso de revaluacion por anulacion de nota de credito ${invoiceCode}`
            : `Ajuste inverso de revaluacion por anulacion de factura ${invoiceCode}`;

        this.adjustments.push({
          id: reverseId,
          tenantId: tenant,
          code,
          warehouseId: adj.warehouseId,
          adjustmentDate: new Date(`${today}T00:00:00.000Z`),
          type: 'revaluation',
          notes: noteText,
          status: 'draft',
          originType,
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
