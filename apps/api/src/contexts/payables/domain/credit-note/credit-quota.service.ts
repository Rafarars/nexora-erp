import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { CreditNoteInvoiceTotalExceededError } from '../errors/payables.errors.js';
import { SupplierCreditNote } from './supplier-credit-note.entity.js';

export class PayableCreditQuota {
  static ensureWithinQuota(
    invoiceTotal: number,
    alreadyCredited: number,
    creditNoteTotal: number,
    invoiceId: string,
  ): void {
    const totalCredited = alreadyCredited + creditNoteTotal;
    // Tolerancia por redondeo de centavos
    if (totalCredited - invoiceTotal > 0.005) {
      throw new CreditNoteInvoiceTotalExceededError(invoiceId, invoiceTotal, totalCredited);
    }
  }

  static available(noteOrTotal: SupplierCreditNote | { total: number } | number, confirmedAppliedPaymentsSum: number): number {
    const total = typeof noteOrTotal === 'number' ? noteOrTotal : 'total' in noteOrTotal && typeof noteOrTotal.total === 'function' ? noteOrTotal.total() : (noteOrTotal as { total: number }).total;
    const totalUnits = amountUnits(total);
    const appliedUnits = amountUnits(confirmedAppliedPaymentsSum);
    const availableUnits = totalUnits - appliedUnits;
    return availableUnits > 0n ? unitsToNumber(availableUnits) : 0;
  }
}
