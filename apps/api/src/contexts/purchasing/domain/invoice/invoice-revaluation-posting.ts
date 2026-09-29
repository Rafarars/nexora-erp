import { TenantId } from '../shared/tenant-id.vo.js';

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

// Puerto por el que compras solicita a inventario la creacion de revaluaciones por importe.
// Vive en el dominio de purchasing; su adaptador escribe en inventario dentro de la misma transaccion.
export interface InvoiceRevaluationPosting {
  createDraftRevaluations(
    tenantId: TenantId,
    invoiceId: string,
    invoiceCode: string,
    revaluations: InvoiceWarehouseRevaluationData[],
    now: Date,
    context?: unknown,
  ): Promise<void>;

  cancelOrReverseRevaluations(
    tenantId: TenantId,
    invoiceId: string,
    invoiceCode: string,
    now: Date,
    context?: unknown,
  ): Promise<void>;
}
