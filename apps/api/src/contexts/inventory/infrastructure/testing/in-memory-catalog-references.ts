import {
  CatalogReferences,
  ReferencedCategory,
  ReferencedPriceList,
  ReferencedTax,
  ReferencedUnit,
  ReferencedWarehouse,
} from '../../domain/catalog/catalog-references.js';
import { CategoryRef, PriceListRef, TaxRef, UnitRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

type OfTenant<T> = T & { tenantId: string };

// Las categorias, impuestos y unidades del catalogo, sembrados a mano en cada prueba.
export class InMemoryCatalogReferences implements CatalogReferences {
  constructor(
    readonly categories: OfTenant<ReferencedCategory>[] = [],
    readonly taxes: OfTenant<ReferencedTax>[] = [],
    readonly units: OfTenant<ReferencedUnit>[] = [],
    readonly warehouses: OfTenant<ReferencedWarehouse>[] = [],
    readonly priceLists: OfTenant<ReferencedPriceList>[] = [],
  ) {}

  async findCategories(tenantId: TenantId, ids: CategoryRef[]): Promise<ReferencedCategory[]> {
    return pick(this.categories, tenantId, ids);
  }

  async findTaxes(tenantId: TenantId, ids: TaxRef[]): Promise<ReferencedTax[]> {
    return pick(this.taxes, tenantId, ids);
  }

  async findUnits(tenantId: TenantId, ids: UnitRef[]): Promise<ReferencedUnit[]> {
    return pick(this.units, tenantId, ids);
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<ReferencedWarehouse[]> {
    return pick(this.warehouses, tenantId, ids);
  }

  async findPriceLists(tenantId: TenantId, ids: PriceListRef[]): Promise<ReferencedPriceList[]> {
    return pick(this.priceLists, tenantId, ids);
  }
}

function pick<T extends { id: string }>(rows: OfTenant<T>[], tenantId: TenantId, ids: { value: string }[]): T[] {
  const wanted = new Set(ids.map((id) => id.value));

  return rows
    .filter((row) => row.tenantId === tenantId.value && wanted.has(row.id))
    .map(({ tenantId: _tenant, ...row }) => row as unknown as T);
}
