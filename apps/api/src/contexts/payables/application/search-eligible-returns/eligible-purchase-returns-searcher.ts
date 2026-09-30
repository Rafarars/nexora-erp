import { PayableInvoiceNotFoundError } from '../../domain/errors/payables.errors.js';
import { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { SupplierCreditNoteRepository } from '../../domain/credit-note/supplier-credit-note.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface EligiblePurchaseReturnLineDto {
  id: string;
  receiptLineId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  unitId: string;
  concept: string;
  quantity: number;
  unitCost: number;
  invoiceLineId: string | null;
  invoicedUnitPrice: number;
}

export interface EligiblePurchaseReturnDto {
  id: string;
  code: string;
  date: string;
  lines: EligiblePurchaseReturnLineDto[];
}

export interface SearchEligiblePurchaseReturnsRequest {
  tenantId: string;
  invoiceId: string;
}

export class EligiblePurchaseReturnsSearcher {
  constructor(
    private readonly creditNotes: SupplierCreditNoteRepository,
    private readonly ledger: PayablesLedger,
  ) {}

  async run(request: SearchEligiblePurchaseReturnsRequest): Promise<EligiblePurchaseReturnDto[]> {
    const tenantId = TenantId.of(request.tenantId);

    const [invoice] = await this.ledger.invoices(tenantId, { ids: [request.invoiceId] });
    if (!invoice) {
      throw new PayableInvoiceNotFoundError(request.invoiceId);
    }

    const invoicePrimitives = invoice.toPrimitives();
    const invoiceLines = await this.ledger.invoiceLines(tenantId, request.invoiceId);

    // Mapeo por receiptLineId para cruzar con las líneas de devoluciones de la misma entrada
    const invoiceReceiptMap = new Map<string, { id: string; unitPrice: number }>();
    for (const line of invoiceLines) {
      if (line.receiptLineId) {
        invoiceReceiptMap.set(line.receiptLineId, {
          id: line.id,
          unitPrice: line.unitPrice ?? line.subtotal,
        });
      }
    }

    if (invoiceReceiptMap.size === 0) {
      return [];
    }

    const [confirmedReturns, creditedReturnIds] = await Promise.all([
      this.ledger.confirmedReturnsBySupplier(tenantId, invoicePrimitives.supplierId),
      this.creditNotes.confirmedCreditedReturnIds(tenantId),
    ]);

    const eligibleReturns: EligiblePurchaseReturnDto[] = [];

    for (const ret of confirmedReturns) {
      // 1. No debe haber sido ya acreditada por otra nota de crédito confirmada
      if (creditedReturnIds.has(ret.id)) {
        continue;
      }

      // 2. Debe tener líneas
      if (!ret.lines || ret.lines.length === 0) {
        continue;
      }

      // 3. Todas sus líneas deben corresponder a entradas facturadas por esta factura
      const allLinesMatch = ret.lines.every((rl) => invoiceReceiptMap.has(rl.receiptLineId));
      if (!allLinesMatch) {
        continue;
      }

      eligibleReturns.push({
        id: ret.id,
        code: ret.code,
        date: ret.date,
        lines: ret.lines.map((rl) => {
          const invLine = invoiceReceiptMap.get(rl.receiptLineId)!;
          return {
            id: rl.id,
            receiptLineId: rl.receiptLineId,
            itemId: rl.itemId,
            itemSku: rl.itemSku,
            itemName: rl.itemName,
            unitId: rl.unitId,
            concept: rl.itemName ? `Devolución ${ret.code} - ${rl.itemName}` : `Devolución ${ret.code}`,
            quantity: rl.quantity,
            unitCost: rl.unitCost,
            invoiceLineId: invLine.id,
            invoicedUnitPrice: invLine.unitPrice,
          };
        }),
      });
    }

    return eligibleReturns;
  }
}
