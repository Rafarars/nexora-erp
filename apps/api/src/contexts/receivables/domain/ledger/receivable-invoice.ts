import { InvoiceNotPayableError, InvoiceOfAnotherCustomerError, PaymentBeforeInvoiceError, PaymentExceedsBalanceError } from '../errors/receivables.errors.js';
import { centsToNumber, toCents } from '../shared/amount.js';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';

export type CollectionStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';

export interface ReceivableInvoicePrimitives {
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

  balanceCents(): bigint {
    return this.row.status === 'cancelled' ? 0n : toCents(this.row.total) - toCents(this.row.paid);
  }

  balance(): number {
    return centsToNumber(this.balanceCents());
  }

  collectionStatus(): CollectionStatus {
    if (this.row.status === 'cancelled') return 'cancelled';
    if (this.balanceCents() <= 0n) return 'paid';

    return toCents(this.row.paid) > 0n ? 'partially_paid' : 'pending';
  }

  // Vencida es la que ya paso su fecha y todavia debe algo. El dia del vencimiento aun no cuenta.
  daysOverdue(today: ReceivablesDate): number {
    if (this.balanceCents() <= 0n) return 0;

    return Math.max(0, ReceivablesDate.of(this.row.dueDate).daysUntil(today));
  }

  isOverdue(today: ReceivablesDate): boolean {
    return this.daysOverdue(today) > 0;
  }

  ensureAccepts(customerId: string, date: ReceivablesDate, amountCents: bigint): void {
    if (this.row.status !== 'issued') throw new InvoiceNotPayableError(this.row.id);
    if (this.row.customerId !== customerId) throw new InvoiceOfAnotherCustomerError(this.row.id, customerId);
    if (date.isBefore(ReceivablesDate.of(this.row.issueDate))) throw new PaymentBeforeInvoiceError(this.row.id, date.value);
    if (amountCents > this.balanceCents()) throw new PaymentExceedsBalanceError(this.row.id, this.balance(), centsToNumber(amountCents));
  }
}
