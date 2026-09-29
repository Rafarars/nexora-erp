import { amountUnits, roundRatio, unitsToNumber } from '../../../../shared/domain/amount.js';
import { DocumentCurrency, DocumentCurrencyPrimitives, rateUnits } from '../../../../shared/domain/document-currency.js';
import {
  InvoiceNotPayableError,
  InvoiceOfAnotherSupplierError,
  PaymentBeforeInvoiceError,
  PaymentExceedsBalanceError,
} from '../errors/payables.errors.js';
import { PayablesDate } from '../shared/payables-date.vo.js';

export type PayableCollectionStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';

export interface PayableInvoicePrimitives extends DocumentCurrencyPrimitives {
  id: string;
  code: string;
  supplierId: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  total: number;
  paid: number;
}

const RATE_SCALE = 100_000_000n;

// Una factura de compra vista desde las cuentas por pagar. La registra compras;
// aqui solo importa cuanto se debe y desde cuando. El saldo no se guarda: es el total menos lo pagado.
export class PayableInvoice {
  private constructor(private readonly row: PayableInvoicePrimitives) {}

  static of(row: PayableInvoicePrimitives): PayableInvoice {
    return new PayableInvoice({ ...row });
  }

  toPrimitives(): PayableInvoicePrimitives {
    return { ...this.row };
  }

  get id(): string {
    return this.row.id;
  }

  get code(): string {
    return this.row.code;
  }

  supplierId(): string {
    return this.row.supplierId;
  }

  currency(): DocumentCurrency {
    return DocumentCurrency.fromPrimitives(this.row);
  }

  // En la moneda de la factura, en diezmilesimas.
  balanceUnits(): bigint {
    return this.row.status === 'cancelled' ? 0n : amountUnits(this.row.total) - amountUnits(this.row.paid);
  }

  total(): number {
    return this.row.total;
  }

  balance(): number {
    return unitsToNumber(this.balanceUnits());
  }

  companyBalanceUnits(decimals: number): bigint {
    return this.currency().baseAmount(this.balanceUnits(), decimals);
  }

  companyBalance(decimals: number): number {
    return unitsToNumber(this.companyBalanceUnits(decimals));
  }

  paymentStatus(): PayableCollectionStatus {
    if (this.row.status === 'cancelled') return 'cancelled';
    if (this.balanceUnits() <= 0n) return 'paid';

    return amountUnits(this.row.paid) > 0n ? 'partially_paid' : 'pending';
  }

  daysOverdue(today: PayablesDate): number {
    if (this.balanceUnits() <= 0n) return 0;

    return Math.max(0, PayablesDate.of(this.row.dueDate).daysUntil(today));
  }

  isOverdue(today: PayablesDate): boolean {
    return this.daysOverdue(today) > 0;
  }

  ensureAccepts(supplierId: string, date: PayablesDate, amount: bigint): void {
    if (this.row.status !== 'confirmed') throw new InvoiceNotPayableError(this.row.id);
    if (this.row.supplierId !== supplierId) throw new InvoiceOfAnotherSupplierError(this.row.id, supplierId);
    if (date.isBefore(PayablesDate.of(this.row.issueDate))) throw new PaymentBeforeInvoiceError(this.row.id, date.value);
    if (amount > this.balanceUnits()) throw new PaymentExceedsBalanceError(this.row.id, this.balance(), unitsToNumber(amount));
  }

  exchangeDifference(amount: bigint, rateOnPayment: number, decimals: number): bigint | null {
    if (this.row.exchangeRate === null) return null;

    return roundRatio(amount * (rateUnits(rateOnPayment) - rateUnits(this.row.exchangeRate)), RATE_SCALE, decimals);
  }
}
