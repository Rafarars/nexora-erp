import { Module } from '@nestjs/common';
import type { Clock } from '../../../shared/domain/ports/clock.js';
import { CLOCK } from '../../../shared/domain/ports/clock.js';
import type { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { ID_GENERATOR } from '../../../shared/domain/ports/id-generator.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { CategoryStatusChanger } from '../application/change-category-status/category-status-changer.js';
import { MeasurementUnitStatusChanger } from '../application/change-measurement-unit-status/measurement-unit-status-changer.js';
import { TaxStatusChanger } from '../application/change-tax-status/tax-status-changer.js';
import { WarehouseStatusChanger } from '../application/change-warehouse-status/warehouse-status-changer.js';
import { CategoryCreator } from '../application/create-category/category-creator.js';
import { MeasurementUnitCreator } from '../application/create-measurement-unit/measurement-unit-creator.js';
import { TaxCreator } from '../application/create-tax/tax-creator.js';
import { WarehouseCreator } from '../application/create-warehouse/warehouse-creator.js';
import { CategorySearcher } from '../application/search-categories/category-searcher.js';
import { MeasurementUnitSearcher } from '../application/search-measurement-units/measurement-unit-searcher.js';
import { TaxSearcher } from '../application/search-taxes/tax-searcher.js';
import { WarehouseSearcher } from '../application/search-warehouses/warehouse-searcher.js';
import { DefaultWarehouseSetter } from '../application/set-default-warehouse/default-warehouse-setter.js';
import { CategoryUpdater } from '../application/update-category/category-updater.js';
import { MeasurementUnitUpdater } from '../application/update-measurement-unit/measurement-unit-updater.js';
import { TaxUpdater } from '../application/update-tax/tax-updater.js';
import { WarehouseUpdater } from '../application/update-warehouse/warehouse-updater.js';
import { CATEGORY_REPOSITORY } from '../domain/category/category.repository.js';
import type { CategoryRepository } from '../domain/category/category.repository.js';
import { CategoryFinder } from '../domain/category/find/category-finder.js';
import { CategoryUniqueness } from '../domain/category/unique/category-uniqueness.js';
import { CatalogUsage } from '../domain/usage/catalog-usage.js';
import { ITEM_USAGE } from '../domain/usage/item-usage.js';
import type { ItemUsage } from '../domain/usage/item-usage.js';
import { MeasurementUnitFinder } from '../domain/measurement-unit/find/measurement-unit-finder.js';
import { MEASUREMENT_UNIT_REPOSITORY } from '../domain/measurement-unit/measurement-unit.repository.js';
import type { MeasurementUnitRepository } from '../domain/measurement-unit/measurement-unit.repository.js';
import { MeasurementUnitUniqueness } from '../domain/measurement-unit/unique/measurement-unit-uniqueness.js';
import { CODE_SEQUENCE } from '../domain/shared/code-sequence.js';
import type { CodeSequence } from '../domain/shared/code-sequence.js';
import { TaxFinder } from '../domain/tax/find/tax-finder.js';
import { TAX_REPOSITORY } from '../domain/tax/tax.repository.js';
import type { TaxRepository } from '../domain/tax/tax.repository.js';
import { TaxUniqueness } from '../domain/tax/unique/tax-uniqueness.js';
import { DefaultWarehouse } from '../domain/warehouse/default/default-warehouse.js';
import { WarehouseFinder } from '../domain/warehouse/find/warehouse-finder.js';
import { WarehouseUniqueness } from '../domain/warehouse/unique/warehouse-uniqueness.js';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse/warehouse.repository.js';
import type { WarehouseRepository } from '../domain/warehouse/warehouse.repository.js';
import { ChangeCategoryStatusPutController } from './http/change-category-status-put.controller.js';
import { ChangeMeasurementUnitStatusPutController } from './http/change-measurement-unit-status-put.controller.js';
import { ChangeTaxStatusPutController } from './http/change-tax-status-put.controller.js';
import { ChangeWarehouseStatusPutController } from './http/change-warehouse-status-put.controller.js';
import { CreateCategoryPostController } from './http/create-category-post.controller.js';
import { CreateMeasurementUnitPostController } from './http/create-measurement-unit-post.controller.js';
import { CreateTaxPostController } from './http/create-tax-post.controller.js';
import { CreateWarehousePostController } from './http/create-warehouse-post.controller.js';
import { SearchCategoriesGetController } from './http/search-categories-get.controller.js';
import { SearchMeasurementUnitsGetController } from './http/search-measurement-units-get.controller.js';
import { SearchTaxesGetController } from './http/search-taxes-get.controller.js';
import { SearchWarehousesGetController } from './http/search-warehouses-get.controller.js';
import { SetDefaultWarehousePutController } from './http/set-default-warehouse-put.controller.js';
import { UpdateCategoryPutController } from './http/update-category-put.controller.js';
import { UpdateMeasurementUnitPutController } from './http/update-measurement-unit-put.controller.js';
import { UpdateTaxPutController } from './http/update-tax-put.controller.js';
import { UpdateWarehousePutController } from './http/update-warehouse-put.controller.js';
import { PrismaCategoryRepository } from './persistence/prisma-category.repository.js';
import { PrismaCodeSequence } from './persistence/prisma-code-sequence.js';
import { PrismaMeasurementUnitRepository } from './persistence/prisma-measurement-unit.repository.js';
import { PrismaTaxRepository } from './persistence/prisma-tax.repository.js';
import { PrismaWarehouseRepository } from './persistence/prisma-warehouse.repository.js';
import { PrismaItemUsage } from './persistence/prisma-item-usage.js';
import { PrismaStockUsage } from './persistence/prisma-stock-usage.js';
import { STOCK_USAGE } from '../domain/stock/stock-usage.js';
import type { StockUsage } from '../domain/stock/stock-usage.js';

// El cableado del catalogo: categorias, unidades, impuestos y bodegas; los articulos viven en el
// inventario. Mismo criterio que en access: los servicios de dominio y
// los casos de uso se construyen con `useFactory`, asi el dominio no importa NestJS.
//
// No declara guardian: el de access es global y ya protege estas rutas. Un contexto
// nuevo nace cerrado sin hacer nada.
@Module({
  imports: [PrismaModule, SharedModule],
  controllers: [
    SearchCategoriesGetController,
    CreateCategoryPostController,
    UpdateCategoryPutController,
    ChangeCategoryStatusPutController,
    SearchMeasurementUnitsGetController,
    CreateMeasurementUnitPostController,
    UpdateMeasurementUnitPutController,
    ChangeMeasurementUnitStatusPutController,
    SearchTaxesGetController,
    CreateTaxPostController,
    UpdateTaxPutController,
    ChangeTaxStatusPutController,
    SearchWarehousesGetController,
    CreateWarehousePostController,
    UpdateWarehousePutController,
    ChangeWarehouseStatusPutController,
    SetDefaultWarehousePutController,
  ],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: MEASUREMENT_UNIT_REPOSITORY, useClass: PrismaMeasurementUnitRepository },
    { provide: TAX_REPOSITORY, useClass: PrismaTaxRepository },
    { provide: WAREHOUSE_REPOSITORY, useClass: PrismaWarehouseRepository },
    { provide: CODE_SEQUENCE, useClass: PrismaCodeSequence },
    { provide: STOCK_USAGE, useClass: PrismaStockUsage },
    { provide: ITEM_USAGE, useClass: PrismaItemUsage },

    // ---- servicios de dominio
    { provide: CategoryFinder, useFactory: (r: CategoryRepository) => new CategoryFinder(r), inject: [CATEGORY_REPOSITORY] },
    { provide: CategoryUniqueness, useFactory: (r: CategoryRepository) => new CategoryUniqueness(r), inject: [CATEGORY_REPOSITORY] },
    {
      provide: MeasurementUnitFinder,
      useFactory: (r: MeasurementUnitRepository) => new MeasurementUnitFinder(r),
      inject: [MEASUREMENT_UNIT_REPOSITORY],
    },
    {
      provide: MeasurementUnitUniqueness,
      useFactory: (r: MeasurementUnitRepository) => new MeasurementUnitUniqueness(r),
      inject: [MEASUREMENT_UNIT_REPOSITORY],
    },
    { provide: TaxFinder, useFactory: (r: TaxRepository) => new TaxFinder(r), inject: [TAX_REPOSITORY] },
    { provide: TaxUniqueness, useFactory: (r: TaxRepository) => new TaxUniqueness(r), inject: [TAX_REPOSITORY] },
    { provide: WarehouseFinder, useFactory: (r: WarehouseRepository) => new WarehouseFinder(r), inject: [WAREHOUSE_REPOSITORY] },
    {
      provide: WarehouseUniqueness,
      useFactory: (r: WarehouseRepository) => new WarehouseUniqueness(r),
      inject: [WAREHOUSE_REPOSITORY],
    },
    { provide: DefaultWarehouse, useFactory: (r: WarehouseRepository) => new DefaultWarehouse(r), inject: [WAREHOUSE_REPOSITORY] },
    { provide: CatalogUsage, useFactory: (i: ItemUsage) => new CatalogUsage(i), inject: [ITEM_USAGE] },
    // ---- categorias
    {
      provide: CategoryCreator,
      useFactory: (r: CategoryRepository, u: CategoryUniqueness, c: CodeSequence, i: IdGenerator, k: Clock) =>
        new CategoryCreator(r, u, c, i, k),
      inject: [CATEGORY_REPOSITORY, CategoryUniqueness, CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: CategoryUpdater,
      useFactory: (f: CategoryFinder, u: CategoryUniqueness, r: CategoryRepository, k: Clock) => new CategoryUpdater(f, u, r, k),
      inject: [CategoryFinder, CategoryUniqueness, CATEGORY_REPOSITORY, CLOCK],
    },
    {
      provide: CategoryStatusChanger,
      useFactory: (f: CategoryFinder, u: CatalogUsage, r: CategoryRepository, k: Clock) => new CategoryStatusChanger(f, u, r, k),
      inject: [CategoryFinder, CatalogUsage, CATEGORY_REPOSITORY, CLOCK],
    },
    { provide: CategorySearcher, useFactory: (r: CategoryRepository) => new CategorySearcher(r), inject: [CATEGORY_REPOSITORY] },

    // ---- unidades
    {
      provide: MeasurementUnitCreator,
      useFactory: (r: MeasurementUnitRepository, u: MeasurementUnitUniqueness, c: CodeSequence, i: IdGenerator, k: Clock) =>
        new MeasurementUnitCreator(r, u, c, i, k),
      inject: [MEASUREMENT_UNIT_REPOSITORY, MeasurementUnitUniqueness, CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: MeasurementUnitUpdater,
      useFactory: (f: MeasurementUnitFinder, u: MeasurementUnitUniqueness, r: MeasurementUnitRepository, k: Clock) =>
        new MeasurementUnitUpdater(f, u, r, k),
      inject: [MeasurementUnitFinder, MeasurementUnitUniqueness, MEASUREMENT_UNIT_REPOSITORY, CLOCK],
    },
    {
      provide: MeasurementUnitStatusChanger,
      useFactory: (f: MeasurementUnitFinder, u: CatalogUsage, r: MeasurementUnitRepository, k: Clock) =>
        new MeasurementUnitStatusChanger(f, u, r, k),
      inject: [MeasurementUnitFinder, CatalogUsage, MEASUREMENT_UNIT_REPOSITORY, CLOCK],
    },
    {
      provide: MeasurementUnitSearcher,
      useFactory: (r: MeasurementUnitRepository) => new MeasurementUnitSearcher(r),
      inject: [MEASUREMENT_UNIT_REPOSITORY],
    },

    // ---- impuestos
    {
      provide: TaxCreator,
      useFactory: (r: TaxRepository, u: TaxUniqueness, c: CodeSequence, i: IdGenerator, k: Clock) => new TaxCreator(r, u, c, i, k),
      inject: [TAX_REPOSITORY, TaxUniqueness, CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: TaxUpdater,
      useFactory: (f: TaxFinder, u: TaxUniqueness, r: TaxRepository, k: Clock) => new TaxUpdater(f, u, r, k),
      inject: [TaxFinder, TaxUniqueness, TAX_REPOSITORY, CLOCK],
    },
    {
      provide: TaxStatusChanger,
      useFactory: (f: TaxFinder, u: CatalogUsage, r: TaxRepository, k: Clock) => new TaxStatusChanger(f, u, r, k),
      inject: [TaxFinder, CatalogUsage, TAX_REPOSITORY, CLOCK],
    },
    { provide: TaxSearcher, useFactory: (r: TaxRepository) => new TaxSearcher(r), inject: [TAX_REPOSITORY] },

    // ---- bodegas
    {
      provide: WarehouseCreator,
      useFactory: (d: DefaultWarehouse, u: WarehouseUniqueness, c: CodeSequence, i: IdGenerator, k: Clock) =>
        new WarehouseCreator(d, u, c, i, k),
      inject: [DefaultWarehouse, WarehouseUniqueness, CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: WarehouseUpdater,
      useFactory: (f: WarehouseFinder, u: WarehouseUniqueness, r: WarehouseRepository, k: Clock) => new WarehouseUpdater(f, u, r, k),
      inject: [WarehouseFinder, WarehouseUniqueness, WAREHOUSE_REPOSITORY, CLOCK],
    },
    {
      provide: WarehouseStatusChanger,
      useFactory: (f: WarehouseFinder, s: StockUsage, r: WarehouseRepository, k: Clock) => new WarehouseStatusChanger(f, s, r, k),
      inject: [WarehouseFinder, STOCK_USAGE, WAREHOUSE_REPOSITORY, CLOCK],
    },
    {
      provide: DefaultWarehouseSetter,
      useFactory: (f: WarehouseFinder, d: DefaultWarehouse, k: Clock) => new DefaultWarehouseSetter(f, d, k),
      inject: [WarehouseFinder, DefaultWarehouse, CLOCK],
    },
    { provide: WarehouseSearcher, useFactory: (r: WarehouseRepository) => new WarehouseSearcher(r), inject: [WAREHOUSE_REPOSITORY] },

  ],
})
export class CatalogModule {}
