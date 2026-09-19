import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';

export interface SupplierResponse {
  id: string;
  code: string;
  name: string;
  fiscalId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermDays: number;
  isActive: boolean;
}

export interface SupplierSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  suppliers: SupplierResponse[];
}

const DEFAULT_PAGE = 20;

// Activos e inactivos salvo que se pidan de un tipo: la interfaz decide que ofrece en cada
// selector. Se busca por codigo, nombre e identificacion fiscal.
export class SupplierSearcher {
  constructor(private readonly suppliers: SupplierRepository) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    active?: 'true' | 'false';
    limit?: number;
    offset?: number;
  }): Promise<SupplierSearcherResponse> {
    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.suppliers.searchPage(TenantId.of(request.tenantId), {
      text: request.q?.trim() ? request.q.trim() : null,
      isActive: request.active === undefined ? null : request.active === 'true',
      limit,
      offset,
    });

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + page.suppliers.length < page.total,
      suppliers: page.suppliers.map((supplier) => {
        const { id, code, name, fiscalId, email, phone, address, paymentTermDays, isActive } = supplier.toPrimitives();

        return { id, code, name, fiscalId, email, phone, address, paymentTermDays, isActive };
      }),
    };
  }
}
