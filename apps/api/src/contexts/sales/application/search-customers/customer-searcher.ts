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
  isActive: boolean;
}

// Activos e inactivos, por nombre: la interfaz decide que ofrece en cada selector.
export class CustomerSearcher {
  constructor(private readonly customers: CustomerRepository) {}

  async run(request: { tenantId: string }): Promise<{ customers: CustomerResponse[] }> {
    const customers = await this.customers.searchByTenant(TenantId.of(request.tenantId));

    return {
      customers: customers
        .map((customer) => {
          const { id, code, name, fiscalId, email, phone, address, paymentTermDays, creditLimit, isActive } = customer.toPrimitives();

          return { id, code, name, fiscalId, email, phone, address, paymentTermDays, creditLimit, isActive };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
