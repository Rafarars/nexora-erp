import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { CreditQuotaExceededError } from '../errors/receivables.errors.js';

// El cupo de importe de una factura: lo que se puede acreditar no puede superar su total
// menos las notas de credito confirmadas anteriores.
export class CreditQuota {
  static available(invoiceTotal: number, alreadyCreditedSum: number): number {
    const totalUnits = amountUnits(invoiceTotal);
    const creditedUnits = amountUnits(alreadyCreditedSum);
    const availableUnits = totalUnits - creditedUnits;
    return availableUnits > 0n ? unitsToNumber(availableUnits) : 0;
  }

  static ensureWithinQuota(invoiceTotal: number, alreadyCreditedSum: number, requestedCredit: number, invoiceId: string): void {
    const available = CreditQuota.available(invoiceTotal, alreadyCreditedSum);
    const availableUnits = amountUnits(available);
    const requestedUnits = amountUnits(requestedCredit);

    if (requestedUnits > availableUnits) {
      throw new CreditQuotaExceededError(invoiceId, available, requestedCredit);
    }
  }
}
