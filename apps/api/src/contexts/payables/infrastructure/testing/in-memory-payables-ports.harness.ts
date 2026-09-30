import { PayableInvoicePrimitives } from '../../domain/ledger/payable-invoice.js';
import { PayableSupplier } from '../../domain/ledger/payables-ledger.js';
import { PayablesPorts, PayablesPortsHarness } from '../../testing/payables-ports.harness.js';
import { InMemoryPayablesCodeSequence } from './in-memory-payables-code-sequence.js';
import { InMemoryPayablesStore } from './in-memory-payables-store.js';

export class InMemoryPayablesPortsHarness implements PayablesPortsHarness {
  private store = new InMemoryPayablesStore();
  private codeSequence = new InMemoryPayablesCodeSequence();

  ports(): PayablesPorts {
    return {
      payments: this.store.payments,
      posting: this.store.posting,
      ledger: this.store.ledger,
      codes: this.codeSequence,
      creditNotes: this.store.creditNotes,
      creditNotePosting: this.store.creditNotePosting,
    };
  }

  async supplier(tenantId: string, supplier: PayableSupplier): Promise<void> {
    this.store.supplier(tenantId, supplier);
  }

  async invoice(tenantId: string, invoice: Omit<PayableInvoicePrimitives, 'paid'>): Promise<void> {
    this.store.invoice(tenantId, invoice);
  }

  async cancelInvoice(_tenantId: string, invoiceId: string): Promise<void> {
    this.store.cancelInvoice(invoiceId);
  }

  async purchaseReturn(
    tenantId: string,
    returnId: string,
    supplierId: string,
    status?: 'confirmed' | 'draft' | 'cancelled',
    receiptLineIds?: string[],
  ): Promise<void> {
    this.store.purchaseReturn(tenantId, returnId, supplierId, status ?? 'confirmed', 'DVC000001', receiptLineIds);
  }

  async setAmountDecimals(tenantId: string, decimals: number): Promise<void> {
    this.store.setAmountDecimals(tenantId, decimals);
  }

  async invoiceLines(
    tenantId: string,
    invoiceId: string,
    lines: Array<{
      id: string;
      itemId?: string | null;
      itemSku?: string | null;
      itemName?: string | null;
      unitId?: string | null;
      quantity?: number;
      unitPrice?: number;
      subtotal: number;
      receiptLineId?: string | null;
      warehouseId?: string;
      receiptRate?: number;
      sourceMovementId?: string;
    }>,
  ): Promise<void> {
    this.store.setInvoiceLines(
      invoiceId,
      lines.map((l) => ({
        id: l.id,
        itemId: l.itemId ?? null,
        itemSku: l.itemSku ?? null,
        itemName: l.itemName ?? null,
        unitId: l.unitId ?? null,
        subtotal: l.subtotal,
        receiptLineId: l.receiptLineId ?? null,
        warehouseId: l.warehouseId,
        receiptRate: l.receiptRate,
        sourceMovementId: l.sourceMovementId,
      })),
    );
  }

  async adjustmentsOf(
    tenantId: string,
    originId: string,
  ): Promise<Array<{
    id: string;
    code: string;
    status: string;
    type: string;
    originType: string;
    originId: string;
    lines: Array<{ itemId: string; amount: number; direction: string; sourceMovementId?: string }>;
  }>> {
    return this.store.revaluationPosting.adjustments
      .filter((a) => a.tenantId === tenantId && a.originId === originId)
      .map((a) => ({
        id: a.id,
        code: a.code,
        status: a.status,
        type: a.type,
        originType: a.originType,
        originId: a.originId,
        lines: a.lines.map((l) => ({
          itemId: l.itemId,
          amount: l.amount,
          direction: l.direction,
          sourceMovementId: l.sourceMovementId,
        })),
      }));
  }

  async approveAdjustment(tenantId: string, adjustmentId: string): Promise<void> {
    const adj = this.store.revaluationPosting.adjustments.find(
      (a) => a.tenantId === tenantId && a.id === adjustmentId,
    );
    if (adj) adj.status = 'confirmed';
  }

  async ensureItem(_tenantId: string, _itemId: string): Promise<void> {}

  async reset(): Promise<void> {
    this.store = new InMemoryPayablesStore();
    this.codeSequence = new InMemoryPayablesCodeSequence();
  }

  async close(): Promise<void> {}
}
