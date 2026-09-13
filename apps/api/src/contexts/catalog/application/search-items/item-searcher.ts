import { CategoryRepository } from '../../domain/category/category.repository.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { MeasurementUnitRepository } from '../../domain/measurement-unit/measurement-unit.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxRepository } from '../../domain/tax/tax.repository.js';
import { ItemSearcherResponse } from './item-searcher.response.js';

// Devuelve los nombres de lo que cada articulo referencia: la interfaz no tiene que
// cruzar cuatro listados, ni pedir permiso para ver categorias o impuestos solo para
// pintar la tabla de articulos.
export class ItemSearcher {
  constructor(
    private readonly items: ItemRepository,
    private readonly categories: CategoryRepository,
    private readonly taxes: TaxRepository,
    private readonly units: MeasurementUnitRepository,
  ) {}

  async run(request: { tenantId: string }): Promise<ItemSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const [items, categories, taxes, units] = await Promise.all([
      this.items.searchByTenant(tenantId),
      this.categories.searchByTenant(tenantId),
      this.taxes.searchByTenant(tenantId),
      this.units.searchByTenant(tenantId),
    ]);

    const categoryById = new Map(categories.map((category) => [category.id.value, category.toPrimitives()]));
    const taxById = new Map(taxes.map((tax) => [tax.id.value, tax.toPrimitives()]));
    const unitById = new Map(units.map((unit) => [unit.id.value, unit.toPrimitives()]));

    return {
      items: items
        .map((item) => {
          const row = item.toPrimitives();
          const category = row.categoryId ? categoryById.get(row.categoryId) : undefined;
          const tax = row.taxId ? taxById.get(row.taxId) : undefined;

          return {
            id: row.id,
            code: row.code,
            sku: row.sku,
            name: row.name,
            description: row.description,
            type: row.type,
            category: category ? { id: category.id, name: category.name } : null,
            tax: tax ? { id: tax.id, name: tax.name, rate: tax.rate } : null,
            // Ya vienen en orden canonico: la base primero.
            units: row.units
              .map((unit) => {
                const found = unitById.get(unit.unitId);

                return {
                  unitId: unit.unitId,
                  name: found?.name ?? '',
                  abbreviation: found?.abbreviation ?? '',
                  conversionFactor: unit.conversionFactor,
                  isBase: unit.isBase,
                };
              }),
            isActive: row.isActive,
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }
}
