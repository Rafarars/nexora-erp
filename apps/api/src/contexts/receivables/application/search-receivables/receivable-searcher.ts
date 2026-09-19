import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { AgingBucket, bucketOf } from '../../domain/aging/aging.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { CollectionStatus } from '../../domain/ledger/receivable-invoice.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { CustomerRef } from '../../domain/shared/references.vo.js';
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

export interface ReceivableSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  receivables: ReceivableResponse[];
}

// El estado de cobro que la pantalla ofrece. Una anulada no se cobra y no entra en la lista, asi
// que tampoco se puede filtrar por ella.
export type CollectableStatus = Exclude<CollectionStatus, 'cancelled'>;

const DEFAULT_PAGE = 20;

// Las facturas vistas desde la cobranza: cuanto deben, desde cuando y en que tramo estan. Las
// anuladas no se cobran y no aparecen. Filtrar por un cliente de otra empresa responde como si no
// existiera, igual que en el resto del sistema.
//
// El estado de cobro y lo vencido salen del saldo, que no es una columna: el libro baja lo que la
// base sabe filtrar y aqui se calculan, se filtran y se corta la pagina. Por eso `total` cuenta
// todo lo que cumple el filtro, no lo que cabe en la pagina.
export class ReceivableSearcher {
  constructor(
    private readonly ledger: ReceivablesLedger,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    customerId?: string | null;
    status?: CollectableStatus;
    from?: string | null;
    to?: string | null;
    onlyOverdue?: 'true' | 'false';
    limit?: number;
    offset?: number;
  }): Promise<ReceivableSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const today = ReceivablesDate.of(await this.calendar.today(request.tenantId));

    // Filtrar por un cliente de otra empresa responde "no existe". Una lista vacia diria que ese
    // cliente no debe nada, que es una respuesta distinta.
    if (request.customerId) {
      const customerId = CustomerRef.of(request.customerId);

      if (!(await this.ledger.customer(tenantId, customerId.value))) throw new ReceivableCustomerNotFoundError(request.customerId);
    }

    const [customers, invoices, decimals] = await Promise.all([
      this.ledger.customers(tenantId),
      this.ledger.invoices(tenantId, {
        onlyIssued: true,
        customerId: request.customerId ?? null,
        text: request.q?.trim() ? request.q.trim() : null,
        from: request.from ?? null,
        to: request.to ?? null,
      }),
      this.rates.amountDecimals(request.tenantId),
    ]);

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const all = invoices
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
          companyBalance: invoice.companyBalance(decimals),
          status: invoice.collectionStatus(),
          daysOverdue: invoice.daysOverdue(today),
          bucket: bucketOf(invoice, today),
        };
      })
      .filter((row) => !request.status || row.status === request.status)
      .filter((row) => request.onlyOverdue !== 'true' || row.daysOverdue > 0)
      // El desempate por codigo evita que dos facturas del mismo dia se turnen entre paginas.
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code));

    return { total: all.length, limit, offset, hasMore: offset + Math.max(0, Math.min(limit, all.length - offset)) < all.length, receivables: all.slice(offset, offset + limit) };
  }
}
