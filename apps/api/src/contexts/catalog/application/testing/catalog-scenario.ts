import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { Category } from '../../domain/category/category.entity.js';
import { CategoryFinder } from '../../domain/category/find/category-finder.js';
import { CategoryUniqueness } from '../../domain/category/unique/category-uniqueness.js';
import { ItemFinder } from '../../domain/item/find/item-finder.js';
import { Item } from '../../domain/item/item.entity.js';
import { ItemReferences } from '../../domain/item/references/item-references.js';
import { SkuUniqueness } from '../../domain/item/unique/sku-uniqueness.js';
import { CatalogUsage } from '../../domain/item/usage/catalog-usage.js';
import { MeasurementUnitFinder } from '../../domain/measurement-unit/find/measurement-unit-finder.js';
import { MeasurementUnit } from '../../domain/measurement-unit/measurement-unit.entity.js';
import { MeasurementUnitUniqueness } from '../../domain/measurement-unit/unique/measurement-unit-uniqueness.js';
import { TaxFinder } from '../../domain/tax/find/tax-finder.js';
import { Tax } from '../../domain/tax/tax.entity.js';
import { TaxUniqueness } from '../../domain/tax/unique/tax-uniqueness.js';
import { NOW } from '../../domain/testing/catalog.mother.js';
import { DefaultWarehouse } from '../../domain/warehouse/default/default-warehouse.js';
import { WarehouseFinder } from '../../domain/warehouse/find/warehouse-finder.js';
import { WarehouseUniqueness } from '../../domain/warehouse/unique/warehouse-uniqueness.js';
import { Warehouse } from '../../domain/warehouse/warehouse.entity.js';
import { InMemoryCategoryRepository } from '../../infrastructure/testing/in-memory-category.repository.js';
import { InMemoryCodeSequence } from '../../infrastructure/testing/in-memory-code-sequence.js';
import { InMemoryItemRepository } from '../../infrastructure/testing/in-memory-item.repository.js';
import { InMemoryMeasurementUnitRepository } from '../../infrastructure/testing/in-memory-measurement-unit.repository.js';
import { InMemoryTaxRepository } from '../../infrastructure/testing/in-memory-tax.repository.js';
import { InMemoryWarehouseRepository } from '../../infrastructure/testing/in-memory-warehouse.repository.js';

// El mundo de una prueba de aplicacion en una linea: sin base de datos, sin Docker y
// sin NestJS.
export function aCatalogScenario(
  seed: {
    categories?: Category[];
    units?: MeasurementUnit[];
    taxes?: Tax[];
    warehouses?: Warehouse[];
    items?: Item[];
  } = {},
) {
  const categories = new InMemoryCategoryRepository(seed.categories ?? []);
  const units = new InMemoryMeasurementUnitRepository(seed.units ?? []);
  const taxes = new InMemoryTaxRepository(seed.taxes ?? []);
  const warehouses = new InMemoryWarehouseRepository(seed.warehouses ?? []);
  const items = new InMemoryItemRepository(seed.items ?? []);
  const codes = new InMemoryCodeSequence();
  const ids: IdGenerator = new SequentialIdGenerator();
  const clock: Clock = new FixedClock(NOW);

  const categoryFinder = new CategoryFinder(categories);
  const unitFinder = new MeasurementUnitFinder(units);
  const taxFinder = new TaxFinder(taxes);

  return {
    categories,
    units,
    taxes,
    warehouses,
    items,
    codes,
    ids,
    clock,
    categoryFinder,
    unitFinder,
    taxFinder,
    warehouseFinder: new WarehouseFinder(warehouses),
    itemFinder: new ItemFinder(items),
    categoryUniqueness: new CategoryUniqueness(categories),
    unitUniqueness: new MeasurementUnitUniqueness(units),
    taxUniqueness: new TaxUniqueness(taxes),
    warehouseUniqueness: new WarehouseUniqueness(warehouses),
    skuUniqueness: new SkuUniqueness(items),
    usage: new CatalogUsage(items),
    references: new ItemReferences(categoryFinder, taxFinder, unitFinder),
    defaultWarehouse: new DefaultWarehouse(warehouses),
  };
}

export type CatalogScenario = ReturnType<typeof aCatalogScenario>;
