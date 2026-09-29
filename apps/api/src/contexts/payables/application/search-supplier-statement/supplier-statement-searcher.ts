import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { PayableSupplierNotFoundError } from '../../domain/errors/payables.errors.js';
import { PayableInvoice } from '../../domain/ledger/payable-invoice.js';
import { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { SupplierPayment } from '../../domain/payment/supplier-payment.entity.js';
import { SupplierPaymentRepository } from '../../domain/payment/payment.repository.js';
import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { PayablesDate } from '../../domain/shared/payables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierBalanceResponse, supplierBalance } from '../search-supplier-balances/supplier-balance-searcher.js';

export interface StatementMovement {
  date: string;
  type: 'invoice' | 'payment';
  code: string;
  // Lo que suma (factura) o resta (pago) al saldo, en la moneda de la empresa
  debit: number;
  credit: number;
  balance: number;
  // De un pago, en bolivares; null si no lo tiene
  exchangeDifference: number | null;
}

export class SupplierStatementSearcher {
  constructor(
    private readonly ledger: PayablesLedger,
    private readonly payments: SupplierPaymentRepository,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string; supplierId: string }): Promise<{ summary: SupplierBalanceResponse; movements: StatementMovement[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const today = PayablesDate.of(await this.calendar.today(request.tenantId));
    const supplier = await this.ledger.supplier(tenantId, request.supplierId);

    if (!supplier) throw new PayableSupplierNotFoundError(request.supplierId);

    const [invoices, payments, decimals]: [PayableInvoice[], SupplierPayment[], number] = await Promise.all([
      this.ledger.invoices(tenantId, { supplierId: supplier.id, onlyConfirmed: true }),
      this.payments.searchByTenant(tenantId),
      this.rates.amountDecimals(request.tenantId),
    ]);

    const owed = new Map<string, bigint>();
    const inCompanyCurrency = (invoiceId: string, units: bigint): bigint =>
      invoices.find((invoice: PayableInvoice) => invoice.id === invoiceId)?.currency().baseAmount(units, decimals) ?? units;

    const paidOff = (invoiceId: string, amount: number): bigint => {
      const before = owed.get(invoiceId) ?? 0n;
      const after = before - amountUnits(amount);
      owed.set(invoiceId, after);
      return inCompanyCurrency(invoiceId, before) - inCompanyCurrency(invoiceId, after);
    };

    const entries = [
      ...invoices.map((invoice: PayableInvoice) => {
        const row = invoice.toPrimitives();
        return {
          date: row.issueDate,
          type: 'invoice' as const,
          code: row.code,
          invoiceId: row.id,
          total: row.total,
          allocations: [] as { invoiceId: string; amount: number }[],
          difference: null as number | null,
        };
      }),
      ...payments
        .map((payment: SupplierPayment) => payment.toPrimitives())
        .filter((payment) => payment.supplierId === supplier.id && payment.status === 'confirmed')
        .map((payment) => {
          const differences = payment.allocations
            .map((a: { exchangeDifference: number | null }) => a.exchangeDifference)
            .filter((v): v is number => v !== null);
          return {
            date: payment.paymentDate,
            type: 'payment' as const,
            code: payment.code,
            invoiceId: null as string | null,
            total: 0,
            allocations: payment.allocations,
            difference: differences.length === 0 ? null : unitsToNumber(differences.reduce((sum: bigint, v: number) => sum + amountUnits(v), 0n)),
          };
        }),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? a.code.localeCompare(b.code) : a.type === 'invoice' ? -1 : 1));

    let running = 0n;

    return {
      summary: supplierBalance(supplier, invoices, today, decimals),
      movements: entries.map((entry) => {
        if (entry.invoiceId !== null) owed.set(entry.invoiceId, amountUnits(entry.total));

        const units: bigint =
          entry.invoiceId !== null
            ? inCompanyCurrency(entry.invoiceId, amountUnits(entry.total))
            : -entry.allocations.reduce((sum: bigint, allocation: { invoiceId: string; amount: number }) => sum + paidOff(allocation.invoiceId, allocation.amount), 0n);

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
