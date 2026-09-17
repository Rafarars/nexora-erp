import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { AgingBucket, bucketOf } from '../../domain/aging/aging.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { CollectionStatus } from '../../domain/ledger/receivable-invoice.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ReceivableResponse {
  id: string;
  code: string;
  customer: { id: string; code: string; name: string };
  issueDate: string;
  dueDate: string;
  // En la moneda de la factura.
  currency: string;
  total: number;
  paid: number;
  balance: number;
  // Lo que debe en la moneda de la empresa, con las tasas de su emision.
  companyBalance: number;
  status: CollectionStatus;
  daysOverdue: number;
  bucket: AgingBucket | null;
}

// Las facturas vistas desde la cobranza: cuanto deben, desde cuando y en que tramo estan. Las
// anuladas no se cobran y no aparecen. Filtrar por un cliente de otra empresa responde como si no
// existiera, igual que en el resto del sistema.
export class ReceivableSearcher {
  constructor(
    private readonly ledger: ReceivablesLedger,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: { tenantId: string; customerId?: string }): Promise<{ receivables: ReceivableResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const today = ReceivablesDate.of(await this.calendar.today(request.tenantId));
    const [customers, invoices] = await Promise.all([this.ledger.customers(tenantId), this.ledger.invoices(tenantId, { customerId: request.customerId })]);

    if (request.customerId && !customers.some((customer) => customer.id === request.customerId)) throw new ReceivableCustomerNotFoundError(request.customerId);

    return {
      receivables: invoices
        .filter((invoice) => invoice.collectionStatus() !== 'cancelled')
        .map((invoice) => {
          const row = invoice.toPrimitives();
          const customer = customers.find((candidate) => candidate.id === row.customerId);

          return {
            id: row.id,
            code: row.code,
            customer: { id: row.customerId, code: customer?.code ?? '', name: customer?.name ?? '' },
            issueDate: row.issueDate,
            dueDate: row.dueDate,
            currency: row.currency,
            total: row.total,
            paid: row.paid,
            balance: invoice.balance(),
            companyBalance: invoice.companyBalance(),
            status: invoice.collectionStatus(),
            daysOverdue: invoice.daysOverdue(today),
            bucket: bucketOf(invoice, today),
          };
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code)),
    };
  }
}
