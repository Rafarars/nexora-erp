import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { centsToNumber, toCents } from '../../domain/shared/amount.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CustomerBalanceResponse, customerBalance } from '../search-customer-balances/customer-balance-searcher.js';

export interface StatementMovement {
  date: string;
  type: 'invoice' | 'payment';
  code: string;
  // Lo que suma (factura) o resta (cobro) al saldo.
  debit: number;
  credit: number;
  balance: number;
}

// El estado de cuenta de un cliente: sus facturas emitidas y sus cobros confirmados por fecha, con
// el saldo que queda tras cada uno. El ultimo saldo coincide con la suma de lo que deben sus
// facturas: si no, algo se cobro dos veces o se perdio.
export class CustomerStatementSearcher {
  constructor(
    private readonly ledger: ReceivablesLedger,
    private readonly payments: PaymentRepository,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: { tenantId: string; customerId: string }): Promise<{ summary: CustomerBalanceResponse; movements: StatementMovement[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const today = ReceivablesDate.of(await this.calendar.today(request.tenantId));
    const customer = await this.ledger.customer(tenantId, request.customerId);

    if (!customer) throw new ReceivableCustomerNotFoundError(request.customerId);

    const [invoices, payments] = await Promise.all([this.ledger.invoices(tenantId, { customerId: customer.id }), this.payments.searchByTenant(tenantId)]);
    const entries = [
      ...invoices
        .map((invoice) => invoice.toPrimitives())
        .filter((invoice) => invoice.status === 'issued')
        .map((invoice) => ({ date: invoice.issueDate, type: 'invoice' as const, code: invoice.code, cents: toCents(invoice.total) })),
      ...payments
        .map((payment) => payment.toPrimitives())
        .filter((payment) => payment.customerId === customer.id && payment.status === 'confirmed')
        .map((payment) => ({ date: payment.paymentDate, type: 'payment' as const, code: payment.code, cents: -toCents(payment.amount) })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? a.code.localeCompare(b.code) : a.type === 'invoice' ? -1 : 1));

    let running = 0n;

    return {
      summary: customerBalance(customer, invoices, today),
      movements: entries.map((entry) => {
        running += entry.cents;

        return {
          date: entry.date,
          type: entry.type,
          code: entry.code,
          debit: entry.cents > 0n ? centsToNumber(entry.cents) : 0,
          credit: entry.cents < 0n ? centsToNumber(-entry.cents) : 0,
          balance: centsToNumber(running),
        };
      }),
    };
  }
}
