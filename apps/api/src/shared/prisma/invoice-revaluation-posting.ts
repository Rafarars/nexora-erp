export const INVOICE_REVALUATION_POSTING = Symbol('InvoiceRevaluationPosting');

export interface InvoiceRevaluationLineData {
  lineNumber: number;
  itemId: string;
  itemSku: string;
  itemName: string;
  unitId: string;
  amount: number; // en moneda base (priceDifferenceBase)
  sourceMovementId: string;
  reason: string;
}

export interface InvoiceWarehouseRevaluationData {
  warehouseId: string;
  lines: InvoiceRevaluationLineData[];
}

export type TenantLike = string | { value: string };

// Puerto compartido para solicitar a inventario la creacion y anulacion de revaluaciones por importe.
// Vive en shared/prisma junto a document-stock-posting. Lo implementa inventario; purchasing y payables
// lo consumen sin depender de otros contextos de dominio.
export interface InvoiceRevaluationPosting {
  createDraftRevaluations(
    tenantId: TenantLike,
    invoiceId: string,
    invoiceCode: string,
    invoiceDate: string,
    revaluations: InvoiceWarehouseRevaluationData[],
    now: Date,
    today: string,
    userId?: string | null,
    context?: unknown,
    originType?: 'purchase_invoice' | 'supplier_credit_note',
  ): Promise<void>;

  cancelOrReverseRevaluations(
    tenantId: TenantLike,
    invoiceId: string,
    invoiceCode: string,
    now: Date,
    today: string,
    userId?: string | null,
    context?: unknown,
    originType?: 'purchase_invoice' | 'supplier_credit_note',
  ): Promise<void>;
}
