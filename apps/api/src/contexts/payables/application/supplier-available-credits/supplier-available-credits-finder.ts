import { PayableSupplierNotFoundError } from '../../domain/errors/payables.errors.js';
import { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { SupplierCreditNoteRepository } from '../../domain/credit-note/supplier-credit-note.repository.js';
import { PayableCreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface AvailableSupplierCreditNoteItem {
  id: string;
  code: string;
  issueDate: string;
  currency: string;
  exchangeRate: number;
  notes: string | null;
  total: number;
  appliedAmount: number;
  availableCredit: number;
}

export interface SupplierAvailableCreditsResponse {
  supplierId: string;
  totalAvailableCredit: number;
  notes: AvailableSupplierCreditNoteItem[];
}

export class SupplierAvailableCreditsFinder {
  constructor(
    private readonly creditNotes: SupplierCreditNoteRepository,
    private readonly ledger: PayablesLedger,
  ) {}

  async run(request: { tenantId: string; supplierId: string }): Promise<SupplierAvailableCreditsResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const supplier = await this.ledger.supplier(tenantId, request.supplierId);

    if (!supplier) {
      throw new PayableSupplierNotFoundError(request.supplierId);
    }

    const availableNotes = await this.creditNotes.findAvailableCreditsBySupplier(tenantId, request.supplierId);
    const appliedMap = await this.creditNotes.appliedAmountsByNotes(
      tenantId,
      availableNotes.map((n) => n.id),
    );

    const items: AvailableSupplierCreditNoteItem[] = [];
    let sumTotal = 0;

    for (const note of availableNotes) {
      const p = note.toPrimitives();
      const applied = appliedMap.get(note.id.value) ?? 0;
      const available = PayableCreditQuota.available(p.total, applied);

      if (available > 0) {
        items.push({
          id: p.id,
          code: p.code,
          issueDate: p.issueDate,
          currency: p.currency,
          exchangeRate: p.exchangeRate ?? 1,
          notes: p.notes,
          total: p.total,
          appliedAmount: applied,
          availableCredit: available,
        });
        sumTotal += available;
      }
    }

    return {
      supplierId: request.supplierId,
      totalAvailableCredit: Number(sumTotal.toFixed(2)),
      notes: items,
    };
  }
}
