import { DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { PayableSupplierNotFoundError } from '../../domain/errors/payables.errors.js';
import { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { PaymentMethod, PaymentStatus } from '../../domain/payment/supplier-payment.entity.js';
import { SupplierPaymentRepository } from '../../domain/payment/payment.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PaymentResponse extends DocumentCurrencyPrimitives {
  id: string;
  code: string;
  supplier: { id: string; code: string; name: string };
  paymentDate: string;
  method: PaymentMethod;
  creditSourceId: string | null;
  creditSourceCode: string | null;
  isIssuePayment: boolean;
  issueCreditNoteCode: string | null;
  reference: string | null;
  notes: string | null;
  // En la moneda del pago.
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

// Los pagos a proveedores por paginas. Se busca por codigo del pago y por su referencia.
export class PaymentSearcher {
  constructor(
    private readonly payments: SupplierPaymentRepository,
    private readonly ledger: PayablesLedger,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    supplierId?: string | null;
    status?: PaymentStatus;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<PaymentSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    // Filtrar por un proveedor de otra empresa responde "no existe", no una lista vacia.
    if (request.supplierId) {
      if (!(await this.ledger.supplier(tenantId, request.supplierId))) throw new PayableSupplierNotFoundError(request.supplierId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.payments.searchPage(tenantId, {
      text: request.q?.trim() ? request.q.trim() : null,
      supplierId: request.supplierId ?? null,
      status: request.status ?? null,
      from: request.from ?? null,
      to: request.to ?? null,
      limit,
      offset,
    });
    const rows = page.payments.map((payment) => payment.toPrimitives());
    const [suppliers, invoices] = await Promise.all([
      this.ledger.suppliers(tenantId),
      this.ledger.invoices(tenantId, { ids: [...new Set(rows.flatMap((row) => row.allocations.map((allocation) => allocation.invoiceId)))] }),
    ]);

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + rows.length < page.total,
      payments: rows.map((row) => {
        const supplier = suppliers.find((candidate) => candidate.id === row.supplierId);

        return {
          id: row.id,
          code: row.code,
          supplier: { id: row.supplierId, code: supplier?.code ?? '', name: supplier?.name ?? '' },
          paymentDate: row.paymentDate,
          method: row.method,
          creditSourceId: row.creditSourceId ?? null,
          creditSourceCode: null,
          isIssuePayment: false,
          issueCreditNoteCode: null,
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
