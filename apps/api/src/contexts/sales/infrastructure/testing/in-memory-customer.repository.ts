import { DuplicateCustomerNameError } from '../../domain/errors/sales.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { Customer, CustomerId, CustomerPrimitives } from '../../domain/customer/customer.entity.js';
import { CustomerCriteria, CustomerPage, CustomerRepository } from '../../domain/customer/customer.repository.js';

// Imita el indice unico de la base: dos clientes con el mismo nombre en una empresa se
// rechazan aunque nadie lo haya comprobado antes.
export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly rows = new Map<string, CustomerPrimitives>();

  async save(customer: Customer): Promise<void> {
    const row = customer.toPrimitives();
    const clash = [...this.rows.values()].find((other) => other.tenantId === row.tenantId && other.name === row.name && other.id !== row.id);

    if (clash) throw new DuplicateCustomerNameError(row.name, row.tenantId);

    this.rows.set(row.id, structuredClone(row));
  }

  async find(tenantId: TenantId, id: CustomerId): Promise<Customer | null> {
    const row = this.rows.get(id.value);

    return row && row.tenantId === tenantId.value ? Customer.fromPrimitives(structuredClone(row)) : null;
  }

  async findByName(tenantId: TenantId, name: string): Promise<Customer | null> {
    const row = [...this.rows.values()].find((candidate) => candidate.tenantId === tenantId.value && candidate.name === name);

    return row ? Customer.fromPrimitives(structuredClone(row)) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Customer[]> {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => Customer.fromPrimitives(structuredClone(row)));
  }

  async searchPage(tenantId: TenantId, criteria: CustomerCriteria): Promise<CustomerPage> {
    const text = criteria.text?.toLowerCase() ?? null;
    const matches = [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .filter((row) => criteria.isActive === null || row.isActive === criteria.isActive)
      .filter(
        (row) =>
          text === null ||
          row.code.toLowerCase().includes(text) ||
          row.name.toLowerCase().includes(text) ||
          (row.fiscalId ?? '').toLowerCase().includes(text),
      )
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    return {
      customers: matches.slice(criteria.offset, criteria.offset + criteria.limit).map((row) => Customer.fromPrimitives(structuredClone(row))),
      total: matches.length,
    };
  }
}
