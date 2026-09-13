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

// Activos e inactivos, por nombre: la interfaz decide que ofrece en cada selector.
export class SupplierSearcher {
  constructor(private readonly suppliers: SupplierRepository) {}

  async run(request: { tenantId: string }): Promise<{ suppliers: SupplierResponse[] }> {
    const suppliers = await this.suppliers.searchByTenant(TenantId.of(request.tenantId));

    return {
      suppliers: suppliers
        .map((supplier) => {
          const { id, code, name, fiscalId, email, phone, address, paymentTermDays, isActive } = supplier.toPrimitives();

          return { id, code, name, fiscalId, email, phone, address, paymentTermDays, isActive };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
