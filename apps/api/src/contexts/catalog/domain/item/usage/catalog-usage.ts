import { CategoryId } from '../../category/category-id.vo.js';
import { CategoryInUseError, MeasurementUnitInUseError, TaxInUseError } from '../../errors/in-use.errors.js';
import { MeasurementUnitId } from '../../measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { TaxId } from '../../tax/tax-id.vo.js';
import { ItemRepository } from '../item.repository.js';

// Lo que un articulo activo usa no se puede desactivar. Vive junto a los articulos
// porque son ellos los que se consultan.
export class CatalogUsage {
  constructor(private readonly items: ItemRepository) {}

  async ensureCategoryIsUnused(tenantId: TenantId, id: CategoryId): Promise<void> {
    if (await this.items.hasActiveWithCategory(tenantId, id)) {
      throw new CategoryInUseError(id.value);
    }
  }

  async ensureTaxIsUnused(tenantId: TenantId, id: TaxId): Promise<void> {
    if (await this.items.hasActiveWithTax(tenantId, id)) {
      throw new TaxInUseError(id.value);
    }
  }

  async ensureUnitIsUnused(tenantId: TenantId, id: MeasurementUnitId): Promise<void> {
    if (await this.items.hasActiveWithUnit(tenantId, id)) {
      throw new MeasurementUnitInUseError(id.value);
    }
  }
}
