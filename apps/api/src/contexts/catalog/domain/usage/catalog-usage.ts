import { CategoryId } from '../category/category-id.vo.js';
import { CategoryInUseError, MeasurementUnitInUseError, TaxInUseError } from '../errors/in-use.errors.js';
import { MeasurementUnitId } from '../measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { TaxId } from '../tax/tax-id.vo.js';
import { ItemUsage } from './item-usage.js';

// Lo que un articulo activo usa no se puede desactivar: el articulo quedaria apuntando a algo
// que ya no se ofrece en ningun selector.
export class CatalogUsage {
  constructor(private readonly items: ItemUsage) {}

  async ensureCategoryIsUnused(tenantId: TenantId, id: CategoryId): Promise<void> {
    if (await this.items.activeItemUsesCategory(tenantId, id)) {
      throw new CategoryInUseError(id.value);
    }
  }

  async ensureTaxIsUnused(tenantId: TenantId, id: TaxId): Promise<void> {
    if (await this.items.activeItemUsesTax(tenantId, id)) {
      throw new TaxInUseError(id.value);
    }
  }

  async ensureUnitIsUnused(tenantId: TenantId, id: MeasurementUnitId): Promise<void> {
    if (await this.items.activeItemUsesUnit(tenantId, id)) {
      throw new MeasurementUnitInUseError(id.value);
    }
  }
}
