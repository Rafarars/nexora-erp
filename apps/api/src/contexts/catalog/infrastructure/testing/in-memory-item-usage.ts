import { CategoryId } from '../../domain/category/category-id.vo.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { ItemUsage } from '../../domain/usage/item-usage.js';
import { TENANT_A } from '../../domain/testing/catalog.mother.js';

// Un articulo tal como lo ve el catalogo: que usa y si esta activo.
export interface UsingItem {
  tenantId?: string;
  isActive?: boolean;
  categoryId?: string | null;
  salesTaxId?: string | null;
  purchaseTaxId?: string | null;
  unitIds?: string[];
}

// Los articulos de la prueba, declarados a mano: el catalogo no conoce su codigo.
export class InMemoryItemUsage implements ItemUsage {
  private readonly items: Required<UsingItem>[] = [];

  constructor(seed: UsingItem[] = []) {
    seed.forEach((item) => this.add(item));
  }

  add(item: UsingItem): void {
    this.items.push({ tenantId: TENANT_A, isActive: true, categoryId: null, salesTaxId: null, purchaseTaxId: null, unitIds: [], ...item });
  }

  async activeItemUsesCategory(tenantId: TenantId, categoryId: CategoryId): Promise<boolean> {
    return this.active(tenantId).some((item) => item.categoryId === categoryId.value);
  }

  async activeItemUsesTax(tenantId: TenantId, taxId: TaxId): Promise<boolean> {
    return this.active(tenantId).some((item) => item.salesTaxId === taxId.value || item.purchaseTaxId === taxId.value);
  }

  async activeItemUsesUnit(tenantId: TenantId, unitId: MeasurementUnitId): Promise<boolean> {
    return this.active(tenantId).some((item) => item.unitIds.includes(unitId.value));
  }

  private active(tenantId: TenantId): Required<UsingItem>[] {
    return this.items.filter((item) => item.isActive && item.tenantId === tenantId.value);
  }
}
