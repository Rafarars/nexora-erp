import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { AgingTotals, agingOf } from '../../domain/aging/aging.js';
import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { centsToNumber, toCents } from '../../domain/shared/amount.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface CustomerBalanceResponse {
  customer: { id: string; code: string; name: string; isActive: boolean };
  paymentTermDays: number;
  creditLimit: number | null;
  balance: number;
  overdue: number;
  // Nulo si el cliente no tiene limite. Puede ser negativo si el limite se bajo despues.
  availableCredit: number | null;
  // Con vencidas no se le puede facturar a credito.
  creditBlocked: boolean;
  aging: AgingTotals;
}

// La antiguedad de saldos: cuanto debe cada cliente, repartido por tramos, y cuanto credito le
// queda. Solo aparecen los clientes que deben algo.
export class CustomerBalanceSearcher {
  constructor(
    private readonly ledger: ReceivablesLedger,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: { tenantId: string }): Promise<{ customers: CustomerBalanceResponse[]; totals: AgingTotals }> {
    const tenantId = TenantId.of(request.tenantId);
    const today = ReceivablesDate.of(await this.calendar.today(request.tenantId));
    const [customers, invoices] = await Promise.all([this.ledger.customers(tenantId), this.ledger.invoices(tenantId)]);

    return {
      customers: customers
        .map((customer) => customerBalance(customer, invoices.filter((invoice) => invoice.customerId() === customer.id), today))
        .filter((row) => row.balance > 0),
      totals: agingOf(invoices, today),
    };
  }
}

export function customerBalance(
  customer: { id: string; code: string; name: string; isActive: boolean; paymentTermDays: number; creditLimit: number | null },
  invoices: ReceivableInvoice[],
  today: ReceivablesDate,
): CustomerBalanceResponse {
  const aging = agingOf(invoices, today);
  const overdue = invoices.filter((invoice) => invoice.isOverdue(today)).reduce((sum, invoice) => sum + invoice.balanceCents(), 0n);

  return {
    customer: { id: customer.id, code: customer.code, name: customer.name, isActive: customer.isActive },
    paymentTermDays: customer.paymentTermDays,
    creditLimit: customer.creditLimit,
    balance: aging.total,
    overdue: centsToNumber(overdue),
    availableCredit: customer.creditLimit === null ? null : centsToNumber(toCents(customer.creditLimit) - toCents(aging.total)),
    creditBlocked: overdue > 0n,
    aging,
  };
}
