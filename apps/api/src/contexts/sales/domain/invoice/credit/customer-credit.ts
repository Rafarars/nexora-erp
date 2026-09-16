import { CreditLimitExceededError, CustomerWithOverdueInvoicesError } from '../../errors/sales.errors.js';

// Lo que hace falta saber del cliente al emitir, leido con el cliente bloqueado.
export interface CustomerCredit {
  customerId: string;
  paymentTermDays: number;
  // Nulo: sin limite.
  creditLimit: number | null;
  openBalance: number;
  hasOverdue: boolean;
}

const base = (value: number) => BigInt(Math.round(value * 10000));

// Solo la factura a credito se frena. La de contado se cobra al emitirla y no suma deuda que
// haya que vigilar.
export function ensureCreditAllows(credit: CustomerCredit, totalBase: bigint): void {
  if (credit.paymentTermDays === 0) return;

  if (credit.hasOverdue) throw new CustomerWithOverdueInvoicesError(credit.customerId);

  if (credit.creditLimit !== null && base(credit.openBalance) + totalBase > base(credit.creditLimit)) {
    throw new CreditLimitExceededError(credit.customerId, credit.creditLimit, credit.openBalance, Number(totalBase) / 10000);
  }
}
