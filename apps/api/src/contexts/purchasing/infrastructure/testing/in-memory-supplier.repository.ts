import { DuplicateSupplierNameError } from '../../domain/errors/purchasing.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { Supplier, SupplierId, SupplierPrimitives } from '../../domain/supplier/supplier.entity.js';
import { SupplierCriteria, SupplierPage, SupplierRepository } from '../../domain/supplier/supplier.repository.js';

// Imita el indice unico de la base: dos proveedores con el mismo nombre en una empresa se
// rechazan aunque nadie lo haya comprobado antes.
export class InMemorySupplierRepository implements SupplierRepository {
  private readonly rows = new Map<string, SupplierPrimitives>();

  async save(supplier: Supplier): Promise<void> {
    const row = supplier.toPrimitives();
    const clash = [...this.rows.values()].find((other) => other.tenantId === row.tenantId && other.name === row.name && other.id !== row.id);

    if (clash) throw new DuplicateSupplierNameError(row.name, row.tenantId);

    this.rows.set(row.id, structuredClone(row));
  }

  async find(tenantId: TenantId, id: SupplierId): Promise<Supplier | null> {
    const row = this.rows.get(id.value);

    return row && row.tenantId === tenantId.value ? Supplier.fromPrimitives(structuredClone(row)) : null;
  }

  async findByName(tenantId: TenantId, name: string): Promise<Supplier | null> {
    const row = [...this.rows.values()].find((candidate) => candidate.tenantId === tenantId.value && candidate.name === name);

    return row ? Supplier.fromPrimitives(structuredClone(row)) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Supplier[]> {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => Supplier.fromPrimitives(structuredClone(row)));
  }

  async searchPage(tenantId: TenantId, criteria: SupplierCriteria): Promise<SupplierPage> {
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
      suppliers: matches.slice(criteria.offset, criteria.offset + criteria.limit).map((row) => Supplier.fromPrimitives(structuredClone(row))),
      total: matches.length,
    };
  }
}
