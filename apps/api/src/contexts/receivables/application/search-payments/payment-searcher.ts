import { DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { CreditNoteId } from '../../domain/credit-note/customer-credit-note.entity.js';
import { CustomerCreditNoteRepository } from '../../domain/credit-note/customer-credit-note.repository.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { PaymentId, PaymentMethod, PaymentStatus } from '../../domain/payment/customer-payment.entity.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { CustomerRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PaymentResponse extends DocumentCurrencyPrimitives {
  id: string;
  code: string;
  customer: { id: string; code: string; name: string };
  paymentDate: string;
  method: PaymentMethod;
  creditSourceId: string | null;
  creditSourceCode: string | null;
  isIssuePayment: boolean;
  issueCreditNoteCode: string | null;
  reference: string | null;
  notes: string | null;
  // En la moneda del cobro.
  amount: number;
  amountVes: number | null;
  status: PaymentStatus;
  // Cada importe en la moneda de su factura; el diferencial, en bolivares.
  allocations: { invoiceId: string; invoiceCode: string; dueDate: string; currency: string; amount: number; exchangeRate: number | null; exchangeDifference: number | null }[];
}

export interface PaymentSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  payments: PaymentResponse[];
}

const DEFAULT_PAGE = 20;

// Los cobros por paginas. Se busca por codigo del cobro y por su referencia, que es el numero de
// transferencia o de cheque con el que la persona lo reconoce.
export class PaymentSearcher {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly ledger: ReceivablesLedger,
    private readonly creditNotes: CustomerCreditNoteRepository,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    customerId?: string | null;
    status?: PaymentStatus;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<PaymentSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    // Filtrar por un cliente de otra empresa responde "no existe", no una lista vacia.
    if (request.customerId) {
      const customerId = CustomerRef.of(request.customerId);

      if (!(await this.ledger.customer(tenantId, customerId.value))) throw new ReceivableCustomerNotFoundError(request.customerId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.payments.searchPage(tenantId, {
      text: request.q?.trim() ? request.q.trim() : null,
      customerId: request.customerId ?? null,
      status: request.status ?? null,
      from: request.from ?? null,
      to: request.to ?? null,
      limit,
      offset,
    });
    const rows = page.payments.map((payment) => payment.toPrimitives());
    const creditSourceIds = [...new Set(rows.map((row) => row.creditSourceId).filter((id): id is string => Boolean(id)))];
    // Solo las facturas y notas de credito que la pagina nombra.
    const [customers, invoices, creditNotes, issueNotes] = await Promise.all([
      this.ledger.customers(tenantId),
      this.ledger.invoices(tenantId, { ids: [...new Set(rows.flatMap((row) => row.allocations.map((allocation) => allocation.invoiceId)))] }),
      creditSourceIds.length > 0 ? this.creditNotes.findByIds(tenantId, creditSourceIds.map(CreditNoteId.of)) : Promise.resolve([]),
      rows.length > 0 ? this.creditNotes.findByIssuePayments(tenantId, rows.map((r) => PaymentId.of(r.id))) : Promise.resolve([]),
    ]);
    const noteMap = new Map(creditNotes.map((note) => [note.id.value, note.toPrimitives().code]));
    const issueNoteMap = new Map(
      issueNotes.filter((note) => note.issuePaymentId() !== null).map((note) => [note.issuePaymentId()!, note.toPrimitives().code]),
    );

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + rows.length < page.total,
      payments: rows.map((row) => {
        const customer = customers.find((candidate) => candidate.id === row.customerId);
        const issueCreditNoteCode = issueNoteMap.get(row.id) ?? null;

        return {
          id: row.id,
          code: row.code,
          customer: { id: row.customerId, code: customer?.code ?? '', name: customer?.name ?? '' },
          paymentDate: row.paymentDate,
          method: row.method,
          creditSourceId: row.creditSourceId ?? null,
          creditSourceCode: row.creditSourceId ? (noteMap.get(row.creditSourceId) ?? null) : null,
          isIssuePayment: issueCreditNoteCode !== null,
          issueCreditNoteCode,
          reference: row.reference,
          notes: row.notes,
          amount: row.amount,
          amountVes: row.amountVes,
          currency: row.currency,
          exchangeRate: row.exchangeRate,
          baseCurrency: row.baseCurrency,
          baseExchangeRate: row.baseExchangeRate,
          manualExchangeRate: row.manualExchangeRate,
          status: row.status,
          allocations: row.allocations.map((allocation) => {
            const invoice = invoices.find((candidate) => candidate.id === allocation.invoiceId)?.toPrimitives();

            return {
              invoiceId: allocation.invoiceId,
              invoiceCode: invoice?.code ?? '',
              dueDate: invoice?.dueDate ?? '',
              currency: invoice?.currency ?? '',
              amount: allocation.amount,
              exchangeRate: allocation.exchangeRate,
              exchangeDifference: allocation.exchangeDifference,
            };
          }),
        };
      }),
    };
  }
}
