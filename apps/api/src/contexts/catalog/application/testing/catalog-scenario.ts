import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { Category } from '../../domain/category/category.entity.js';
import { CategoryFinder } from '../../domain/category/find/category-finder.js';
import { CategoryUniqueness } from '../../domain/category/unique/category-uniqueness.js';
import { CatalogUsage } from '../../domain/usage/catalog-usage.js';
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
import { InMemoryMeasurementUnitRepository } from '../../infrastructure/testing/in-memory-measurement-unit.repository.js';
import { InMemoryTaxRepository } from '../../infrastructure/testing/in-memory-tax.repository.js';
import { InMemoryWarehouseRepository } from '../../infrastructure/testing/in-memory-warehouse.repository.js';
import { InMemoryItemUsage } from '../../infrastructure/testing/in-memory-item-usage.js';
import { InMemoryStockUsage } from '../../infrastructure/testing/in-memory-stock-usage.js';

// El mundo de una prueba de aplicacion en una linea: sin base de datos, sin Docker y
// sin NestJS.
export function aCatalogScenario(
  seed: {
    categories?: Category[];
    units?: MeasurementUnit[];
    taxes?: Tax[];
    warehouses?: Warehouse[];
  } = {},
) {
  const categories = new InMemoryCategoryRepository(seed.categories ?? []);
  const units = new InMemoryMeasurementUnitRepository(seed.units ?? []);
  const taxes = new InMemoryTaxRepository(seed.taxes ?? []);
  const warehouses = new InMemoryWarehouseRepository(seed.warehouses ?? []);
  const codes = new InMemoryCodeSequence();
  // Los articulos viven en el inventario: aqui solo se declara que usan.
  const itemUsage = new InMemoryItemUsage();
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
    codes,
    ids,
    clock,
    categoryFinder,
    unitFinder,
    taxFinder,
    warehouseFinder: new WarehouseFinder(warehouses),
    categoryUniqueness: new CategoryUniqueness(categories),
    unitUniqueness: new MeasurementUnitUniqueness(units),
    taxUniqueness: new TaxUniqueness(taxes),
    warehouseUniqueness: new WarehouseUniqueness(warehouses),
    itemUsage,
    usage: new CatalogUsage(itemUsage),
    defaultWarehouse: new DefaultWarehouse(warehouses),
    stock: new InMemoryStockUsage(),
  };
}

export type CatalogScenario = ReturnType<typeof aCatalogScenario>;
