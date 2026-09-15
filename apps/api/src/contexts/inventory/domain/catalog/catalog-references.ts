import { CategoryRef, TaxRef, UnitRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const CATALOG_REFERENCES = Symbol('CatalogReferences');

// Lo que un articulo usa del catalogo, con el vocabulario del inventario: su categoria, su
// impuesto y sus unidades. Cada metodo devuelve solo lo que existe en la empresa; lo que no
// aparece, no existe para ella.
export interface ReferencedCategory {
  id: string;
  name: string;
  isActive: boolean;
}

export interface ReferencedTax {
  id: string;
  name: string;
  rate: number;
  isActive: boolean;
}

export interface ReferencedUnit {
  id: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
}

export interface CatalogReferences {
  findCategories(tenantId: TenantId, ids: CategoryRef[]): Promise<ReferencedCategory[]>;
  findTaxes(tenantId: TenantId, ids: TaxRef[]): Promise<ReferencedTax[]>;
  findUnits(tenantId: TenantId, ids: UnitRef[]): Promise<ReferencedUnit[]>;
}
