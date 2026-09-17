import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CustomerBalanceResponse, customerBalance } from '../search-customer-balances/customer-balance-searcher.js';

export interface StatementMovement {
  date: string;
  type: 'invoice' | 'payment';
  code: string;
  // Lo que suma (factura) o resta (cobro) al saldo, en la moneda de la empresa.
  debit: number;
  credit: number;
  balance: number;
  // De un cobro, en bolivares; null si no lo tiene.
  exchangeDifference: number | null;
}

// El estado de cuenta de un cliente: sus facturas emitidas y sus cobros confirmados por fecha, con
// el saldo que queda tras cada uno, en la moneda de la empresa y con las tasas de cada factura. El
// ultimo saldo coincide con la suma de lo que deben sus facturas: si no, algo se cobro dos veces o se
// perdio.
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
    const inCompanyCurrency = (invoiceId: string, amount: number) =>
      invoices.find((invoice) => invoice.id === invoiceId)?.currency().toBase(amountUnits(amount)) ?? amountUnits(amount);
    const entries = [
      ...invoices
        .filter((invoice) => invoice.toPrimitives().status === 'issued')
        .map((invoice) => {
          const row = invoice.toPrimitives();

          return { date: row.issueDate, type: 'invoice' as const, code: row.code, units: invoice.currency().toBase(amountUnits(row.total)), difference: null };
        }),
      ...payments
        .map((payment) => payment.toPrimitives())
        .filter((payment) => payment.customerId === customer.id && payment.status === 'confirmed')
        .map((payment) => {
          const differences = payment.allocations.map((allocation) => allocation.exchangeDifference).filter((value): value is number => value !== null);

          return {
            date: payment.paymentDate,
            type: 'payment' as const,
            code: payment.code,
            units: -payment.allocations.reduce((sum, allocation) => sum + inCompanyCurrency(allocation.invoiceId, allocation.amount), 0n),
            difference: differences.length === 0 ? null : unitsToNumber(differences.reduce((sum, value) => sum + amountUnits(value), 0n)),
          };
        }),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? a.code.localeCompare(b.code) : a.type === 'invoice' ? -1 : 1));

    let running = 0n;

    return {
      summary: customerBalance(customer, invoices, today),
      movements: entries.map((entry) => {
        running += entry.units;

        return {
          date: entry.date,
          type: entry.type,
          code: entry.code,
          debit: entry.units > 0n ? unitsToNumber(entry.units) : 0,
          credit: entry.units < 0n ? unitsToNumber(-entry.units) : 0,
          balance: unitsToNumber(running),
          exchangeDifference: entry.difference,
        };
      }),
    };
  }
}
