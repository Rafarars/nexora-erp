import { amountUnits, roundRatio, unitsToNumber } from '../../../../shared/domain/amount.js';
import { DocumentCurrency, DocumentCurrencyPrimitives, rateUnits } from '../../../../shared/domain/document-currency.js';
import { InvoiceNotPayableError, InvoiceOfAnotherCustomerError, PaymentBeforeInvoiceError, PaymentExceedsBalanceError } from '../errors/receivables.errors.js';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';

export type CollectionStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';

// Los importes estan en la moneda de la factura; las tasas son las de su emision.
export interface ReceivableInvoicePrimitives extends DocumentCurrencyPrimitives {
  id: string;
  code: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  status: 'issued' | 'cancelled';
  total: number;
  // Lo aplicado por cobros confirmados.
  paid: number;
}

const RATE_SCALE = 100_000_000n;

// Una factura vista desde la cobranza. La emite ventas; aqui solo importa cuanto se debe y
// desde cuando. El saldo no se guarda: es el total menos lo cobrado.
export class ReceivableInvoice {
  private constructor(private readonly row: ReceivableInvoicePrimitives) {}

  static of(row: ReceivableInvoicePrimitives): ReceivableInvoice {
    return new ReceivableInvoice({ ...row });
  }

  toPrimitives(): ReceivableInvoicePrimitives {
    return { ...this.row };
  }

  get id(): string {
    return this.row.id;
  }

  customerId(): string {
    return this.row.customerId;
  }

  currency(): DocumentCurrency {
    return DocumentCurrency.fromPrimitives(this.row);
  }

  // En la moneda de la factura, en diezmilesimas.
  balanceUnits(): bigint {
    return this.row.status === 'cancelled' ? 0n : amountUnits(this.row.total) - amountUnits(this.row.paid);
  }

  balance(): number {
    return unitsToNumber(this.balanceUnits());
  }

  // Lo que debe en la moneda de la empresa, con las tasas de su emision y redondeado a sus decimales:
  // asi se suman los saldos, igual que en la base al emitir a credito.
  companyBalanceUnits(decimals: number): bigint {
    return this.currency().baseAmount(this.balanceUnits(), decimals);
  }

  companyBalance(decimals: number): number {
    return unitsToNumber(this.companyBalanceUnits(decimals));
  }

  collectionStatus(): CollectionStatus {
    if (this.row.status === 'cancelled') return 'cancelled';
    if (this.balanceUnits() <= 0n) return 'paid';

    return amountUnits(this.row.paid) > 0n ? 'partially_paid' : 'pending';
  }

  // Vencida es la que ya paso su fecha y todavia debe algo. El dia del vencimiento aun no cuenta.
  daysOverdue(today: ReceivablesDate): number {
    if (this.balanceUnits() <= 0n) return 0;

    return Math.max(0, ReceivablesDate.of(this.row.dueDate).daysUntil(today));
  }

  isOverdue(today: ReceivablesDate): boolean {
    return this.daysOverdue(today) > 0;
  }

  ensureAccepts(customerId: string, date: ReceivablesDate, amount: bigint): void {
    if (this.row.status !== 'issued') throw new InvoiceNotPayableError(this.row.id);
    if (this.row.customerId !== customerId) throw new InvoiceOfAnotherCustomerError(this.row.id, customerId);
    if (date.isBefore(ReceivablesDate.of(this.row.issueDate))) throw new PaymentBeforeInvoiceError(this.row.id, date.value);
    if (amount > this.balanceUnits()) throw new PaymentExceedsBalanceError(this.row.id, this.balance(), unitsToNumber(amount));
  }

  // El diferencial cambiario de lo que un cobro le rebaja, en bolivares: vale a la tasa del dia del
  // cobro menos lo que valia a la de la factura. Sin tasa de emision no se puede saber.
  exchangeDifference(amount: bigint, rateOnPayment: number, decimals: number): bigint | null {
    if (this.row.exchangeRate === null) return null;

    return roundRatio(amount * (rateUnits(rateOnPayment) - rateUnits(this.row.exchangeRate)), RATE_SCALE, decimals);
  }
}
