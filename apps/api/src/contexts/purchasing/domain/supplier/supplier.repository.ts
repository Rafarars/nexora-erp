import { TenantId } from '../shared/tenant-id.vo.js';
import { Supplier, SupplierId } from './supplier.entity.js';

export const SUPPLIER_REPOSITORY = Symbol('SupplierRepository');

// Lo que la pantalla de proveedores ofrece. `text` busca por codigo, nombre e identificacion
// fiscal, que es por lo que alguien busca a un proveedor.
export interface SupplierCriteria {
  text: string | null;
  // Nulo trae activos e inactivos: los selectores piden solo activos.
  isActive: boolean | null;
  limit: number;
  offset: number;
}

export interface SupplierPage {
  suppliers: Supplier[];
  total: number;
}

export interface SupplierRepository {
  save(supplier: Supplier): Promise<void>;
  find(tenantId: TenantId, id: SupplierId): Promise<Supplier | null>;
  findByName(tenantId: TenantId, name: string): Promise<Supplier | null>;
  searchByTenant(tenantId: TenantId): Promise<Supplier[]>;
  searchPage(tenantId: TenantId, criteria: SupplierCriteria): Promise<SupplierPage>;
}
