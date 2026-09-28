import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { CustomerCreditNote } from './customer-credit-note.entity.js';

// Total de la nota menos lo repartido por sus cobros confirmados.
export class NoteCredit {
  static available(noteOrTotal: CustomerCreditNote | { total: number } | number, confirmedAppliedPaymentsSum: number): number {
    const total = typeof noteOrTotal === 'number' ? noteOrTotal : 'total' in noteOrTotal && typeof noteOrTotal.total === 'function' ? noteOrTotal.total() : (noteOrTotal as { total: number }).total;
    const totalUnits = amountUnits(total);
    const appliedUnits = amountUnits(confirmedAppliedPaymentsSum);
    const availableUnits = totalUnits - appliedUnits;
    return availableUnits > 0n ? unitsToNumber(availableUnits) : 0;
  }
}
