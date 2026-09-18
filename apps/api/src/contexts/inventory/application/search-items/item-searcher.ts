import { CatalogReferences } from '../../domain/catalog/catalog-references.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { CategoryRef, TaxRef, UnitRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ItemSearcherResponse } from './item-searcher.response.js';

// Devuelve los nombres de lo que cada articulo referencia: la interfaz no tiene que
// cruzar cuatro listados, ni pedir permiso para ver categorias o impuestos solo para
// pintar la tabla de articulos.
export class ItemSearcher {
  constructor(
    private readonly items: ItemRepository,
    private readonly catalog: CatalogReferences,
  ) {}

  async run(request: { tenantId: string }): Promise<ItemSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const rows = (await this.items.searchByTenant(tenantId)).map((item) => item.toPrimitives());
    const distinct = (ids: (string | null)[]) => [...new Set(ids.filter((id): id is string => id !== null))];

    const [categories, taxes, units] = await Promise.all([
      this.catalog.findCategories(tenantId, distinct(rows.map((row) => row.categoryId)).map((id) => CategoryRef.of(id))),
      this.catalog.findTaxes(tenantId, distinct(rows.flatMap((row) => [row.salesTaxId, row.purchaseTaxId])).map((id) => TaxRef.of(id))),
      this.catalog.findUnits(tenantId, distinct(rows.flatMap((row) => row.units.map((unit) => unit.unitId))).map((id) => UnitRef.of(id))),
    ]);

    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const taxById = new Map(taxes.map((tax) => [tax.id, tax]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));

    return {
      items: rows
        .map((row) => {
          const category = row.categoryId ? categoryById.get(row.categoryId) : undefined;
          const taxOf = (id: string | null) => {
            const tax = id ? taxById.get(id) : undefined;

            return tax ? { id: tax.id, name: tax.name, rate: tax.rate } : null;
          };

          return {
            id: row.id,
            code: row.code,
            sku: row.sku,
            name: row.name,
            description: row.description,
            type: row.type,
            category: category ? { id: category.id, name: category.name } : null,
            salesTax: taxOf(row.salesTaxId),
            purchaseTax: taxOf(row.purchaseTaxId),
            // Ya vienen en orden canonico: la base primero.
            units: row.units.map((unit) => {
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
