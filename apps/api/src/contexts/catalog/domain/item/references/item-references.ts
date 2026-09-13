import { CategoryFinder } from '../../category/find/category-finder.js';
import { InactiveReferenceError } from '../../errors/inactive-reference.error.js';
import { MeasurementUnitFinder } from '../../measurement-unit/find/measurement-unit-finder.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { TaxFinder } from '../../tax/find/tax-finder.js';
import { Item, ItemDetails } from '../item.entity.js';

// Todo lo que un articulo referencia tiene que existir en SU empresa y estar activo.
// Al editar se tolera conservar una referencia que ya tenia aunque se haya desactivado
// despues: obligar a cambiarla para corregir una descripcion no tendria sentido.
export class ItemReferences {
  constructor(
    private readonly categories: CategoryFinder,
    private readonly taxes: TaxFinder,
    private readonly units: MeasurementUnitFinder,
  ) {}

  async ensureAssignable(tenantId: TenantId, details: ItemDetails, current?: Item): Promise<void> {
    if (details.categoryId) {
      const category = await this.categories.find(tenantId, details.categoryId);
      const kept = current?.usesCategory(details.categoryId) ?? false;

      if (!category.isActive() && !kept) {
        throw new InactiveReferenceError('Category', category.id.value);
      }
    }

    if (details.taxId) {
      const tax = await this.taxes.find(tenantId, details.taxId);
      const kept = current?.usesTax(details.taxId) ?? false;

      if (!tax.isActive() && !kept) {
        throw new InactiveReferenceError('Tax', tax.id.value);
      }
    }

    const units = await this.units.findAll(tenantId, details.units.unitIds());

    for (const unit of units) {
      if (!unit.isActive() && !(current?.usesUnit(unit.id) ?? false)) {
        throw new InactiveReferenceError('MeasurementUnit', unit.id.value);
      }
    }
  }

  // Reactivar un articulo que apunta a algo desactivado lo devolveria a los selectores
  // con una referencia que ya no se ofrece.
  async ensureActive(tenantId: TenantId, item: Item): Promise<void> {
    const categoryId = item.categoryId();
    const taxId = item.taxId();

    if (categoryId && !(await this.categories.find(tenantId, categoryId)).isActive()) {
      throw new InactiveReferenceError('Category', categoryId.value);
    }

    if (taxId && !(await this.taxes.find(tenantId, taxId)).isActive()) {
      throw new InactiveReferenceError('Tax', taxId.value);
    }

    for (const unit of await this.units.findAll(tenantId, item.unitIds())) {
      if (!unit.isActive()) {
        throw new InactiveReferenceError('MeasurementUnit', unit.id.value);
      }
    }
  }
}
