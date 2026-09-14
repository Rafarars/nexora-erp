import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { PaymentMethod, PaymentStatus } from '../../domain/payment/customer-payment.entity.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PaymentResponse {
  id: string;
  code: string;
  customer: { id: string; code: string; name: string };
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  amount: number;
  status: PaymentStatus;
  allocations: { invoiceId: string; invoiceCode: string; dueDate: string; amount: number }[];
}

export class PaymentSearcher {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly ledger: ReceivablesLedger,
  ) {}

  async run(request: { tenantId: string }): Promise<{ payments: PaymentResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const [payments, customers, invoices] = await Promise.all([this.payments.searchByTenant(tenantId), this.ledger.customers(tenantId), this.ledger.invoices(tenantId)]);

    return {
      payments: payments
        .map((payment) => payment.toPrimitives())
        .sort((a, b) => b.code.localeCompare(a.code))
        .map((row) => {
          const customer = customers.find((candidate) => candidate.id === row.customerId);

          return {
            id: row.id,
            code: row.code,
            customer: { id: row.customerId, code: customer?.code ?? '', name: customer?.name ?? '' },
            paymentDate: row.paymentDate,
            method: row.method,
            reference: row.reference,
            notes: row.notes,
            amount: row.amount,
            status: row.status,
            allocations: row.allocations.map((allocation) => {
              const invoice = invoices.find((candidate) => candidate.id === allocation.invoiceId)?.toPrimitives();

              return { invoiceId: allocation.invoiceId, invoiceCode: invoice?.code ?? '', dueDate: invoice?.dueDate ?? '', amount: allocation.amount };
            }),
          };
        }),
    };
  }
}
