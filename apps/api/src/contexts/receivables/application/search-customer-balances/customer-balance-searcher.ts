import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { AgingTotals, agingOf } from '../../domain/aging/aging.js';
import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Todo en la moneda de la empresa.
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

export interface CustomerBalanceSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  customers: CustomerBalanceResponse[];
  // La fila de totales de la pantalla: suma TODO lo que cumple el filtro, no la pagina. Sumar solo
  // la pagina haria que la pantalla dijera que la empresa cobra veinte clientes.
  totals: AgingTotals;
}

const DEFAULT_PAGE = 20;

// La antiguedad de saldos: cuanto debe cada cliente, repartido por tramos, y cuanto credito le
// queda. Por defecto solo aparecen los clientes que deben algo.
//
// El saldo no es una columna, sale de restar lo cobrado a lo facturado: el libro baja los clientes
// que cumplen el texto y aqui se calculan los saldos, se filtran, se suman los totales sobre todos
// y solo al final se corta la pagina.
export class CustomerBalanceSearcher {
  constructor(
    private readonly ledger: ReceivablesLedger,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    onlyWithBalance?: 'true' | 'false';
    limit?: number;
    offset?: number;
  }): Promise<CustomerBalanceSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const today = ReceivablesDate.of(await this.calendar.today(request.tenantId));
    const [customers, invoices, decimals] = await Promise.all([
      this.ledger.customers(tenantId, { text: request.q?.trim() ? request.q.trim() : null }),
      this.ledger.invoices(tenantId),
      this.rates.amountDecimals(request.tenantId),
    ]);

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const matched = new Set(customers.map((customer) => customer.id));
    const all = customers
      .map((customer) => customerBalance(customer, invoices.filter((invoice) => invoice.customerId() === customer.id), today, decimals))
      .filter((row) => request.onlyWithBalance === 'false' || row.balance > 0);

    return {
      total: all.length,
      limit,
      offset,
      hasMore: offset + Math.max(0, Math.min(limit, all.length - offset)) < all.length,
      customers: all.slice(offset, offset + limit),
      // Sobre las facturas de todos los clientes que cumplen el filtro, no las de la pagina.
      totals: agingOf(invoices.filter((invoice) => matched.has(invoice.customerId())), today, decimals),
    };
  }
}

export function customerBalance(
  customer: { id: string; code: string; name: string; isActive: boolean; paymentTermDays: number; creditLimit: number | null },
  invoices: ReceivableInvoice[],
  today: ReceivablesDate,
  decimals: number,
): CustomerBalanceResponse {
  const aging = agingOf(invoices, today, decimals);
  const overdue = invoices.filter((invoice) => invoice.isOverdue(today)).reduce((sum, invoice) => sum + invoice.companyBalanceUnits(decimals), 0n);

  return {
    customer: { id: customer.id, code: customer.code, name: customer.name, isActive: customer.isActive },
    paymentTermDays: customer.paymentTermDays,
    creditLimit: customer.creditLimit,
    balance: aging.total,
    overdue: unitsToNumber(overdue),
    availableCredit: customer.creditLimit === null ? null : unitsToNumber(amountUnits(customer.creditLimit) - amountUnits(aging.total)),
    creditBlocked: overdue > 0n,
    aging,
  };
}
