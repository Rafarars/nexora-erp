import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { CustomerRef } from '../../domain/shared/references.vo.js';
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
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string; customerId: string }): Promise<{ summary: CustomerBalanceResponse; movements: StatementMovement[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const today = ReceivablesDate.of(await this.calendar.today(request.tenantId));
    // Se valida el formato antes de consultar: un identificador malo es una peticion incorrecta,
    // no un fallo del servidor.
    const customerId = CustomerRef.of(request.customerId);
    const customer = await this.ledger.customer(tenantId, customerId.value);

    if (!customer) throw new ReceivableCustomerNotFoundError(request.customerId);

    const [invoices, payments, decimals] = await Promise.all([
      this.ledger.invoices(tenantId, { customerId: customer.id }),
      this.payments.searchByTenant(tenantId),
      this.rates.amountDecimals(request.tenantId),
    ]);
    // Lo que aun debe cada factura, en su moneda. Un cobro rebaja en la moneda de la empresa lo que
    // valia el saldo antes menos lo que vale despues, ambos redondeados: asi el ultimo saldo es
    // exactamente la suma de los saldos de las facturas, sin centimos que se pierdan al redondear.
    const owed = new Map<string, bigint>();
    const inCompanyCurrency = (invoiceId: string, units: bigint) =>
      invoices.find((invoice) => invoice.id === invoiceId)?.currency().baseAmount(units, decimals) ?? units;
    const paidOff = (invoiceId: string, amount: number) => {
      const before = owed.get(invoiceId) ?? 0n;
      const after = before - amountUnits(amount);

      owed.set(invoiceId, after);

      return inCompanyCurrency(invoiceId, before) - inCompanyCurrency(invoiceId, after);
    };
    const entries = [
      ...invoices
        .filter((invoice) => invoice.toPrimitives().status === 'issued')
        .map((invoice) => {
          const row = invoice.toPrimitives();

          return { date: row.issueDate, type: 'invoice' as const, code: row.code, invoiceId: row.id, total: row.total, allocations: [], difference: null };
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
            invoiceId: null,
            total: 0,
            allocations: payment.allocations,
            difference: differences.length === 0 ? null : unitsToNumber(differences.reduce((sum, value) => sum + amountUnits(value), 0n)),
          };
        }),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? a.code.localeCompare(b.code) : a.type === 'invoice' ? -1 : 1));

    let running = 0n;

    return {
      summary: customerBalance(customer, invoices, today, decimals),
      movements: entries.map((entry) => {
        if (entry.invoiceId !== null) owed.set(entry.invoiceId, amountUnits(entry.total));

        const units =
          entry.invoiceId !== null
            ? inCompanyCurrency(entry.invoiceId, amountUnits(entry.total))
            : -entry.allocations.reduce((sum, allocation) => sum + paidOff(allocation.invoiceId, allocation.amount), 0n);

        running += units;

        return {
          date: entry.date,
          type: entry.type,
          code: entry.code,
          debit: units > 0n ? unitsToNumber(units) : 0,
          credit: units < 0n ? unitsToNumber(-units) : 0,
          balance: unitsToNumber(running),
          exchangeDifference: entry.difference,
        };
      }),
    };
  }
}
