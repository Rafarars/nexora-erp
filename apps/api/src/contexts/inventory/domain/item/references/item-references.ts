import { CatalogReferences, ReferencedCategory, ReferencedTax, ReferencedUnit } from '../../catalog/catalog-references.js';
import {
  CategoryNotFoundError,
  InactiveReferenceError,
  MeasurementUnitNotFoundError,
  TaxNotFoundError,
} from '../../errors/item.errors.js';
import { CategoryRef, TaxRef, UnitRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { Item, ItemDetails } from '../item.entity.js';

// Todo lo que un articulo referencia tiene que existir en SU empresa y estar activo, y eso lo
// sabe el catalogo. Al editar se tolera conservar una referencia que ya tenia aunque se haya
// desactivado despues: obligar a cambiarla para corregir una descripcion no tendria sentido.
export class ItemReferences {
  constructor(private readonly catalog: CatalogReferences) {}

  async ensureAssignable(tenantId: TenantId, details: ItemDetails, current?: Item): Promise<void> {
    if (details.categoryId) {
      const category = await this.category(tenantId, details.categoryId);

      if (!category.isActive && !(current?.usesCategory(details.categoryId) ?? false)) {
        throw new InactiveReferenceError('Category', category.id);
      }
    }

    for (const taxId of [details.salesTaxId, details.purchaseTaxId]) {
      if (!taxId) continue;

      const tax = await this.tax(tenantId, taxId);

      if (!tax.isActive && !(current?.usesTax(taxId) ?? false)) {
        throw new InactiveReferenceError('Tax', tax.id);
      }
    }

    for (const unit of await this.units(tenantId, details.units.unitIds())) {
      if (!unit.isActive && !(current?.usesUnit(UnitRef.of(unit.id)) ?? false)) {
        throw new InactiveReferenceError('MeasurementUnit', unit.id);
      }
    }
  }

  // Reactivar un articulo que apunta a algo desactivado lo devolveria a los selectores
  // con una referencia que ya no se ofrece.
  async ensureActive(tenantId: TenantId, item: Item): Promise<void> {
    const categoryId = item.categoryId();

    if (categoryId && !(await this.category(tenantId, categoryId)).isActive) {
      throw new InactiveReferenceError('Category', categoryId.value);
    }

    for (const taxId of item.taxIds()) {
      if (!(await this.tax(tenantId, taxId)).isActive) {
        throw new InactiveReferenceError('Tax', taxId.value);
      }
    }

    for (const unit of await this.units(tenantId, item.unitIds())) {
      if (!unit.isActive) {
        throw new InactiveReferenceError('MeasurementUnit', unit.id);
      }
    }
  }

  private async category(tenantId: TenantId, id: CategoryRef): Promise<ReferencedCategory> {
    const [category] = await this.catalog.findCategories(tenantId, [id]);

    if (!category) throw new CategoryNotFoundError(id.value);

    return category;
  }

  private async tax(tenantId: TenantId, id: TaxRef): Promise<ReferencedTax> {
    const [tax] = await this.catalog.findTaxes(tenantId, [id]);

    if (!tax) throw new TaxNotFoundError(id.value);

    return tax;
  }

  // Todas o ninguna: si falta una, el articulo no se guarda con las unidades a medias.
  private async units(tenantId: TenantId, ids: UnitRef[]): Promise<ReferencedUnit[]> {
    const found = await this.catalog.findUnits(tenantId, ids);

    return ids.map((id) => {
      const unit = found.find((candidate) => candidate.id === id.value);

      if (!unit) throw new MeasurementUnitNotFoundError(id.value);

      return unit;
    });
  }
}
