import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { PayableInvoice, Statement, SupplierAvailableCredit, SupplierBalance } from '../domain/payables';
import type {
  CreditNoteFilters,
  CreditNoteInput,
  CreditNotePage,
  PayableInvoiceFilters,
  PayableInvoicePage,
  PaymentFilters,
  PaymentInput,
  PaymentPage,
  PayablesApi,
  SupplierBalanceFilters,
  SupplierBalancePage,
} from '../domain/payables-api';

const BASE = '/api/v1/payables';
const SELECTOR_PAGE = 50;

// NaN no existe en JSON: se manda como texto y la API senala el campo.
const numeric = (value: number) => (Number.isNaN(value) ? 'NaN' : value);

// Los esquemas son estrictos: solo viaja el filtro que trae valor.
function queryOf(filters: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }

  return query.size > 0 ? `?${query.toString()}` : '';
}

export class HttpPayablesApi implements PayablesApi {
  constructor(private readonly baseUrl: string) {}

  async searchPayments(token: string, filters: PaymentFilters = {}): Promise<PaymentPage> {
    return this.request<PaymentPage>('GET', `${BASE}/payments${queryOf(filters)}`, token);
  }

  async savePayment(token: string, id: string | null, input: PaymentInput): Promise<void> {
    const body = {
      ...input,
      exchangeRate: input.exchangeRate === null ? null : numeric(input.exchangeRate),
      allocations: input.allocations.map((allocation) => ({ ...allocation, amount: numeric(allocation.amount) })),
    };

    await this.request(id ? 'PUT' : 'POST', id ? `${BASE}/payments/${id}` : `${BASE}/payments`, token, body);
  }

  async confirmPayment(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/payments/${id}/confirm`, token);
  }

  async cancelPayment(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/payments/${id}/cancel`, token);
  }

  async searchCreditNotes(token: string, filters: CreditNoteFilters = {}): Promise<CreditNotePage> {
    return this.request<CreditNotePage>('GET', `${BASE}/credit-notes${queryOf(filters)}`, token);
  }

  async saveCreditNote(token: string, id: string | null, input: CreditNoteInput): Promise<void> {
    const body = {
      ...input,
      exchangeRate: input.exchangeRate == null ? null : numeric(input.exchangeRate),
      lines: input.lines.map((line) => ({
        ...line,
        quantity: numeric(line.quantity),
        unitPrice: numeric(line.unitPrice),
        taxRate: numeric(line.taxRate),
      })),
    };

    await this.request(id ? 'PUT' : 'POST', id ? `${BASE}/credit-notes/${id}` : `${BASE}/credit-notes`, token, body);
  }

  async confirmCreditNote(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/credit-notes/${id}/confirm`, token);
  }

  async cancelCreditNote(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/credit-notes/${id}/cancel`, token);
  }

  async availableCredits(token: string, supplierId: string): Promise<SupplierAvailableCredit[]> {
    return this.request<SupplierAvailableCredit[]>('GET', `${BASE}/suppliers/${encodeURIComponent(supplierId)}/available-credits`, token);
  }

  async searchPayableInvoices(token: string, filters: PayableInvoiceFilters = {}): Promise<PayableInvoicePage> {
    return this.request<PayableInvoicePage>('GET', `${BASE}/invoices${queryOf(filters)}`, token);
  }

  async allInvoices(token: string): Promise<PayableInvoice[]> {
    return everyPage(async (offset) => {
      const page = await this.searchPayableInvoices(token, { limit: SELECTOR_PAGE, offset });
      return { rows: page.invoices, hasMore: page.hasMore };
    });
  }

  async searchSupplierBalances(token: string, filters: SupplierBalanceFilters = {}): Promise<SupplierBalancePage> {
    return this.request<SupplierBalancePage>('GET', `${BASE}/suppliers${queryOf(filters)}`, token);
  }

  async allSuppliers(token: string): Promise<SupplierBalance['supplier'][]> {
    const rows = await everyPage(async (offset) => {
      const page = await this.searchSupplierBalances(token, { onlyWithBalance: 'false', limit: SELECTOR_PAGE, offset });
      return { rows: page.suppliers, hasMore: page.hasMore };
    });

    return rows.map((row) => row.supplier);
  }

  async searchStatement(token: string, supplierId: string): Promise<Statement> {
    return this.request<Statement>('GET', `${BASE}/suppliers/${encodeURIComponent(supplierId)}/statement`, token);
  }

  private async request<T = void>(method: string, path: string, token: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) throw AccessError.fromStatus(response.status, await errorBodyOf(response));

    const text = await response.text();

    return (text.length > 0 ? JSON.parse(text) : undefined) as T;
  }
}

async function everyPage<T>(pageAt: (offset: number) => Promise<{ rows: T[]; hasMore: boolean }>): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await pageAt(offset);
    all.push(...page.rows);
    offset += page.rows.length;
    hasMore = page.hasMore && page.rows.length > 0;
  }

  return all;
}

async function errorBodyOf(response: Response): Promise<AccessErrorBody> {
  try {
    const body = await response.json();

    return {
      message: String(body.message ?? ''),
      code: typeof body.error === 'string' ? body.error : '',
      fields: Array.isArray(body.fields) ? body.fields.map(String) : [],
    };
  } catch {
    return {};
  }
}
