import { TenantId } from '../shared/tenant-id.vo.js';
import { Supplier, SupplierId } from './supplier.entity.js';

export const SUPPLIER_REPOSITORY = Symbol('SupplierRepository');

export interface SupplierRepository {
  save(supplier: Supplier): Promise<void>;
  find(tenantId: TenantId, id: SupplierId): Promise<Supplier | null>;
  findByName(tenantId: TenantId, name: string): Promise<Supplier | null>;
  searchByTenant(tenantId: TenantId): Promise<Supplier[]>;
}
