import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';

export interface CustomerResponse {
  id: string;
  code: string;
  name: string;
  fiscalId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermDays: number;
  creditLimit: number | null;
  priceListId: string | null;
  isActive: boolean;
}

export interface CustomerSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  customers: CustomerResponse[];
}

const DEFAULT_PAGE = 20;

// Activos e inactivos salvo que se pidan de un tipo: la interfaz decide que ofrece en cada
// selector. Se busca por codigo, nombre e identificacion fiscal.
export class CustomerSearcher {
  constructor(private readonly customers: CustomerRepository) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    active?: 'true' | 'false';
    limit?: number;
    offset?: number;
  }): Promise<CustomerSearcherResponse> {
    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.customers.searchPage(TenantId.of(request.tenantId), {
      text: request.q?.trim() ? request.q.trim() : null,
      isActive: request.active === undefined ? null : request.active === 'true',
      limit,
      offset,
    });

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + page.customers.length < page.total,
      customers: page.customers.map((customer) => {
        const { id, code, name, fiscalId, email, phone, address, paymentTermDays, creditLimit, priceListId, isActive } = customer.toPrimitives();

        return { id, code, name, fiscalId, email, phone, address, paymentTermDays, creditLimit, priceListId, isActive };
      }),
    };
  }
}
