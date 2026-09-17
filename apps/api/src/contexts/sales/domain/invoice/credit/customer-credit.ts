import { amountUnits, unitsToNumber } from '../../../../../shared/domain/amount.js';
import { CreditLimitExceededError, CustomerWithOverdueInvoicesError } from '../../errors/sales.errors.js';

// Lo que hace falta saber del cliente al emitir, leido con el cliente bloqueado. El limite y la
// deuda estan en la moneda de la empresa.
export interface CustomerCredit {
  customerId: string;
  paymentTermDays: number;
  // Nulo: sin limite.
  creditLimit: number | null;
  openBalance: number;
  hasOverdue: boolean;
}

// Solo la factura a credito se frena. La de contado se cobra al emitirla y no suma deuda que
// haya que vigilar. `total` es el de la factura en la moneda de la empresa, en diezmilesimas.
export function ensureCreditAllows(credit: CustomerCredit, total: bigint): void {
  if (credit.paymentTermDays === 0) return;

  if (credit.hasOverdue) throw new CustomerWithOverdueInvoicesError(credit.customerId);

  if (credit.creditLimit !== null && amountUnits(credit.openBalance) + total > amountUnits(credit.creditLimit)) {
    throw new CreditLimitExceededError(credit.customerId, credit.creditLimit, credit.openBalance, unitsToNumber(total));
  }
}
