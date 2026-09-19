import { CatalogReferences } from '../../domain/catalog/catalog-references.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { CategoryRef, PriceListRef, TaxRef, UnitRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ItemSearcherResponse } from './item-searcher.response.js';

// Devuelve los nombres de lo que cada articulo referencia: la interfaz no tiene que
// cruzar cuatro listados, ni pedir permiso para ver categorias o impuestos solo para
// pintar la tabla de articulos.
// Lo que devuelve una pagina sin pedir nada: lo mismo que ofrece la pantalla.
const DEFAULT_PAGE = 20;

export class ItemSearcher {
  constructor(
    private readonly items: ItemRepository,
    private readonly catalog: CatalogReferences,
  ) {}

  async run(request: { tenantId: string; q?: string; limit?: number; offset?: number }): Promise<ItemSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const text = request.q?.trim() ? request.q.trim() : null;
    const page = await this.items.search(tenantId, { text, limit, offset });
    const rows = page.items.map((item) => item.toPrimitives());
    const distinct = (ids: (string | null)[]) => [...new Set(ids.filter((id): id is string => id !== null))];

    const [categories, taxes, units, warehouses, priceLists] = await Promise.all([
      this.catalog.findCategories(tenantId, distinct(rows.map((row) => row.categoryId)).map((id) => CategoryRef.of(id))),
      this.catalog.findTaxes(tenantId, distinct(rows.flatMap((row) => [row.salesTaxId, row.purchaseTaxId])).map((id) => TaxRef.of(id))),
      this.catalog.findUnits(tenantId, distinct(rows.flatMap((row) => row.units.map((unit) => unit.unitId))).map((id) => UnitRef.of(id))),
      this.catalog.findWarehouses(tenantId, distinct(rows.flatMap((row) => row.reorderRules.map((rule) => rule.warehouseId))).map((id) => WarehouseRef.of(id))),
      this.catalog.findPriceLists(tenantId, distinct(rows.flatMap((row) => row.prices.map((price) => price.priceListId))).map((id) => PriceListRef.of(id))),
    ]);

    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const taxById = new Map(taxes.map((tax) => [tax.id, tax]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
    const priceListById = new Map(priceLists.map((priceList) => [priceList.id, priceList]));

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + rows.length < page.total,
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
            barcode: row.barcode,
            isPurchasable: row.isPurchasable,
            isSellable: row.isSellable,
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
            reorderRules: row.reorderRules.map((rule) => ({
              warehouse: { id: rule.warehouseId, name: warehouseById.get(rule.warehouseId)?.name ?? '' },
              minQuantity: rule.minQuantity,
              maxQuantity: rule.maxQuantity,
              reorderQuantity: rule.reorderQuantity,
            })),
            prices: row.prices.map((price) => {
              const found = priceListById.get(price.priceListId);

              return {
                priceList: { id: price.priceListId, name: found?.name ?? '', currency: found?.currency ?? '' },
                price: price.price,
              };
            }),
            minPrice: row.minPrice,
            isActive: row.isActive,
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    };
  }
}
