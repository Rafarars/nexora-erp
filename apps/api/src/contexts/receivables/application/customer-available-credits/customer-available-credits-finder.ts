import { CustomerRef } from '../../domain/shared/references.vo.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { CustomerCreditNoteRepository } from '../../domain/credit-note/customer-credit-note.repository.js';
import { NoteCredit } from '../../domain/credit-note/note-credit.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface AvailableCreditNoteItem {
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

export interface CustomerAvailableCreditsResponse {
  customerId: string;
  totalAvailableCredit: number;
  notes: AvailableCreditNoteItem[];
}

export class CustomerAvailableCreditsFinder {
  constructor(
    private readonly creditNotes: CustomerCreditNoteRepository,
    private readonly ledger: ReceivablesLedger,
  ) {}

  async run(request: { tenantId: string; customerId: string }): Promise<CustomerAvailableCreditsResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const customer = await this.ledger.customer(tenantId, CustomerRef.of(request.customerId).value);

    if (!customer) {
      throw new ReceivableCustomerNotFoundError(request.customerId);
    }

    const availableNotes = await this.creditNotes.findAvailableCreditsByCustomer(tenantId, request.customerId);
    const appliedMap = await this.creditNotes.appliedAmountsByNotes(
      tenantId,
      availableNotes.map((n) => n.id),
    );

    const items: AvailableCreditNoteItem[] = [];
    let sumTotal = 0;

    for (const note of availableNotes) {
      const p = note.toPrimitives();
      const applied = appliedMap.get(note.id.value) ?? 0;
      const available = NoteCredit.available(p.total, applied);

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
      customerId: request.customerId,
      totalAvailableCredit: Number(sumTotal.toFixed(2)),
      notes: items,
    };
  }
}
