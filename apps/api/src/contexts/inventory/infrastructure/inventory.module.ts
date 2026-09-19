import { BUSINESS_CALENDAR } from '../../../shared/domain/ports/business-calendar.js';
import type { BusinessCalendar } from '../../../shared/domain/ports/business-calendar.js';
import { Module } from '@nestjs/common';
import type { Clock } from '../../../shared/domain/ports/clock.js';
import { CLOCK } from '../../../shared/domain/ports/clock.js';
import type { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { ID_GENERATOR } from '../../../shared/domain/ports/id-generator.js';
import { DOCUMENT_STOCK_POSTING } from '../../../shared/prisma/document-stock-posting.js';
import { CompanyModule } from '../../company/infrastructure/company.module.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { AdjustmentCanceller } from '../application/cancel-adjustment/adjustment-canceller.js';
import { AdjustmentConfirmer } from '../application/confirm-adjustment/adjustment-confirmer.js';
import { AdjustmentCreator } from '../application/create-adjustment/adjustment-creator.js';
import { AdjustmentSearcher } from '../application/search-adjustments/adjustment-searcher.js';
import { MovementSearcher } from '../application/search-movements/movement-searcher.js';
import { LowStockSearcher } from '../application/search-low-stock/low-stock-searcher.js';
import { StockSearcher } from '../application/search-stock/stock-searcher.js';
import { AdjustmentUpdater } from '../application/update-adjustment/adjustment-updater.js';
import { ItemStatusChanger } from '../application/change-item-status/item-status-changer.js';
import { ItemCreator } from '../application/create-item/item-creator.js';
import { ItemSearcher } from '../application/search-items/item-searcher.js';
import { ItemUpdater } from '../application/update-item/item-updater.js';
import { CATALOG_REFERENCES } from '../domain/catalog/catalog-references.js';
import type { CatalogReferences } from '../domain/catalog/catalog-references.js';
import { ItemFinder } from '../domain/item/find/item-finder.js';
import { ITEM_REPOSITORY } from '../domain/item/item.repository.js';
import type { ItemRepository } from '../domain/item/item.repository.js';
import { ITEM_POSTING } from '../domain/item/posting/item-posting.js';
import type { ItemPosting } from '../domain/item/posting/item-posting.js';
import { ItemReferences } from '../domain/item/references/item-references.js';
import { BarcodeUniqueness } from '../domain/item/unique/barcode-uniqueness.js';
import { SkuUniqueness } from '../domain/item/unique/sku-uniqueness.js';
import { ADJUSTMENT_REPOSITORY } from '../domain/adjustment/adjustment.repository.js';
import type { AdjustmentRepository } from '../domain/adjustment/adjustment.repository.js';
import { AdjustmentFinder } from '../domain/adjustment/find/adjustment-finder.js';
import { AdjustmentLineFactory } from '../domain/adjustment/lines/adjustment-line-factory.js';
import { AdjustmentCancellation } from '../domain/adjustment/posting/adjustment-cancellation.js';
import { AdjustmentConfirmation } from '../domain/adjustment/posting/adjustment-confirmation.js';
import { ADJUSTMENT_POSTING } from '../domain/adjustment/posting/adjustment-posting.js';
import type { AdjustmentPosting } from '../domain/adjustment/posting/adjustment-posting.js';
import { MOVEMENT_DOCUMENTS } from '../domain/documents/movement-documents.js';
import { EXPECTED_STOCK, ExpectedStock } from '../domain/stock/expected-stock.js';
import type { MovementDocuments } from '../domain/documents/movement-documents.js';
import { StockMovements } from '../domain/stock/posting/stock-movements.js';
import { INVENTORY_CATALOG } from '../domain/catalog/inventory-catalog.js';
import type { InventoryCatalog } from '../domain/catalog/inventory-catalog.js';
import { INVENTORY_CODE_SEQUENCE } from '../domain/shared/code-sequence.js';
import type { InventoryCodeSequence } from '../domain/shared/code-sequence.js';
import { STOCK_REPOSITORY } from '../domain/stock/stock.repository.js';
import type { StockRepository } from '../domain/stock/stock.repository.js';
import { CancelAdjustmentPutController } from './http/cancel-adjustment-put.controller.js';
import { ChangeItemStatusPutController } from './http/change-item-status-put.controller.js';
import { CreateItemPostController } from './http/create-item-post.controller.js';
import { SearchItemsGetController } from './http/search-items-get.controller.js';
import { UpdateItemPutController } from './http/update-item-put.controller.js';
import { ConfirmAdjustmentPutController } from './http/confirm-adjustment-put.controller.js';
import { CreateAdjustmentPostController } from './http/create-adjustment-post.controller.js';
import { SearchAdjustmentsGetController } from './http/search-adjustments-get.controller.js';
import { SearchMovementsGetController } from './http/search-movements-get.controller.js';
import { SearchLowStockGetController } from './http/search-low-stock-get.controller.js';
import { SearchStockGetController } from './http/search-stock-get.controller.js';
import { UpdateAdjustmentPutController } from './http/update-adjustment-put.controller.js';
import { PrismaDocumentStockPosting } from './persistence/prisma-document-stock-posting.js';
import { PrismaExpectedStock } from './persistence/prisma-expected-stock.js';
import { PrismaMovementDocuments } from './persistence/prisma-movement-documents.js';
import { PrismaAdjustmentPosting } from './persistence/prisma-adjustment-posting.js';
import { PrismaAdjustmentRepository } from './persistence/prisma-adjustment.repository.js';
import { PrismaCatalogReferences } from './persistence/prisma-catalog-references.js';
import { PrismaItemPosting } from './persistence/prisma-item-posting.js';
import { PrismaItemRepository } from './persistence/prisma-item.repository.js';
import { PrismaInventoryCatalog } from './persistence/prisma-inventory-catalog.js';
import { PrismaInventoryCodeSequence } from './persistence/prisma-inventory-code-sequence.js';
import { PrismaStockRepository } from './persistence/prisma-stock.repository.js';

// El cableado del inventario, con el mismo criterio que los otros contextos: el maestro de
// articulos, las existencias, el kardex y los ajustes. Exporta solo la publicacion de documentos:
// es lo unico que otro contexto puede pedirle.
@Module({
  imports: [PrismaModule, SharedModule, CompanyModule],
  controllers: [
    SearchItemsGetController,
    CreateItemPostController,
    UpdateItemPutController,
    ChangeItemStatusPutController,
    SearchAdjustmentsGetController,
    CreateAdjustmentPostController,
    UpdateAdjustmentPutController,
    ConfirmAdjustmentPutController,
    CancelAdjustmentPutController,
    SearchStockGetController,
    SearchLowStockGetController,
    SearchMovementsGetController,
  ],
  providers: [
    { provide: ADJUSTMENT_REPOSITORY, useClass: PrismaAdjustmentRepository },
    { provide: STOCK_REPOSITORY, useClass: PrismaStockRepository },
    { provide: ADJUSTMENT_POSTING, useClass: PrismaAdjustmentPosting },
    { provide: INVENTORY_CATALOG, useClass: PrismaInventoryCatalog },
    { provide: INVENTORY_CODE_SEQUENCE, useClass: PrismaInventoryCodeSequence },
    { provide: MOVEMENT_DOCUMENTS, useClass: PrismaMovementDocuments },
    { provide: EXPECTED_STOCK, useClass: PrismaExpectedStock },
    { provide: DOCUMENT_STOCK_POSTING, useClass: PrismaDocumentStockPosting },
    { provide: ITEM_REPOSITORY, useClass: PrismaItemRepository },
    { provide: ITEM_POSTING, useClass: PrismaItemPosting },
    { provide: CATALOG_REFERENCES, useClass: PrismaCatalogReferences },

    // ---- articulos
    { provide: ItemFinder, useFactory: (r: ItemRepository) => new ItemFinder(r), inject: [ITEM_REPOSITORY] },
    { provide: SkuUniqueness, useFactory: (r: ItemRepository) => new SkuUniqueness(r), inject: [ITEM_REPOSITORY] },
    { provide: BarcodeUniqueness, useFactory: (r: ItemRepository) => new BarcodeUniqueness(r), inject: [ITEM_REPOSITORY] },
    { provide: ItemReferences, useFactory: (c: CatalogReferences) => new ItemReferences(c), inject: [CATALOG_REFERENCES] },
    {
      provide: ItemCreator,
      useFactory: (r: ItemRepository, ref: ItemReferences, s: SkuUniqueness, b: BarcodeUniqueness, c: InventoryCodeSequence, i: IdGenerator, k: Clock) =>
        new ItemCreator(r, ref, s, b, c, i, k),
      inject: [ITEM_REPOSITORY, ItemReferences, SkuUniqueness, BarcodeUniqueness, INVENTORY_CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: ItemUpdater,
      useFactory: (f: ItemFinder, ref: ItemReferences, s: SkuUniqueness, b: BarcodeUniqueness, p: ItemPosting, k: Clock) => new ItemUpdater(f, ref, s, b, p, k),
      inject: [ItemFinder, ItemReferences, SkuUniqueness, BarcodeUniqueness, ITEM_POSTING, CLOCK],
    },
    {
      provide: ItemStatusChanger,
      useFactory: (f: ItemFinder, ref: ItemReferences, p: ItemPosting, k: Clock) => new ItemStatusChanger(f, ref, p, k),
      inject: [ItemFinder, ItemReferences, ITEM_POSTING, CLOCK],
    },
    {
      provide: ItemSearcher,
      useFactory: (r: ItemRepository, c: CatalogReferences) => new ItemSearcher(r, c),
      inject: [ITEM_REPOSITORY, CATALOG_REFERENCES],
    },

    // ---- ajustes, existencias y kardex

    { provide: AdjustmentFinder, useFactory: (r: AdjustmentRepository) => new AdjustmentFinder(r), inject: [ADJUSTMENT_REPOSITORY] },
    {
      provide: AdjustmentLineFactory,
      useFactory: (c: InventoryCatalog, i: IdGenerator) => new AdjustmentLineFactory(c, i),
      inject: [INVENTORY_CATALOG, ID_GENERATOR],
    },
    { provide: StockMovements, useFactory: (i: IdGenerator) => new StockMovements(i), inject: [ID_GENERATOR] },
    { provide: AdjustmentConfirmation, useFactory: (m: StockMovements) => new AdjustmentConfirmation(m), inject: [StockMovements] },
    { provide: AdjustmentCancellation, useFactory: (m: StockMovements) => new AdjustmentCancellation(m), inject: [StockMovements] },

    {
      provide: AdjustmentCreator,
      useFactory: (f: AdjustmentLineFactory, r: AdjustmentRepository, c: InventoryCodeSequence, i: IdGenerator, k: Clock, cal: BusinessCalendar) =>
        new AdjustmentCreator(f, r, c, i, k, cal),
      inject: [AdjustmentLineFactory, ADJUSTMENT_REPOSITORY, INVENTORY_CODE_SEQUENCE, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR],
    },
    {
      provide: AdjustmentUpdater,
      useFactory: (finder: AdjustmentFinder, f: AdjustmentLineFactory, r: AdjustmentRepository, k: Clock, cal: BusinessCalendar) =>
        new AdjustmentUpdater(finder, f, r, k, cal),
      inject: [AdjustmentFinder, AdjustmentLineFactory, ADJUSTMENT_REPOSITORY, CLOCK, BUSINESS_CALENDAR],
    },
    {
      provide: AdjustmentConfirmer,
      useFactory: (
        finder: AdjustmentFinder,
        f: AdjustmentLineFactory,
        r: AdjustmentRepository,
        p: AdjustmentPosting,
        c: AdjustmentConfirmation,
        k: Clock, cal: BusinessCalendar) => new AdjustmentConfirmer(finder, f, r, p, c, k, cal),
      inject: [AdjustmentFinder, AdjustmentLineFactory, ADJUSTMENT_REPOSITORY, ADJUSTMENT_POSTING, AdjustmentConfirmation, CLOCK, BUSINESS_CALENDAR],
    },
    {
      provide: AdjustmentCanceller,
      useFactory: (p: AdjustmentPosting, c: AdjustmentCancellation, k: Clock) => new AdjustmentCanceller(p, c, k),
      inject: [ADJUSTMENT_POSTING, AdjustmentCancellation, CLOCK],
    },
    {
      provide: AdjustmentSearcher,
      useFactory: (r: AdjustmentRepository, c: InventoryCatalog) => new AdjustmentSearcher(r, c),
      inject: [ADJUSTMENT_REPOSITORY, INVENTORY_CATALOG],
    },
    {
      provide: StockSearcher,
      useFactory: (s: StockRepository, c: InventoryCatalog) => new StockSearcher(s, c),
      inject: [STOCK_REPOSITORY, INVENTORY_CATALOG],
    },
    {
      provide: LowStockSearcher,
      useFactory: (i: ItemRepository, s: StockRepository, c: InventoryCatalog, e: ExpectedStock) => new LowStockSearcher(i, s, c, e),
      inject: [ITEM_REPOSITORY, STOCK_REPOSITORY, INVENTORY_CATALOG, EXPECTED_STOCK],
    },
    {
      provide: MovementSearcher,
      useFactory: (s: StockRepository, d: MovementDocuments, c: InventoryCatalog) => new MovementSearcher(s, d, c),
      inject: [STOCK_REPOSITORY, MOVEMENT_DOCUMENTS, INVENTORY_CATALOG],
    },
  ],
  exports: [DOCUMENT_STOCK_POSTING],
})
export class InventoryModule {}
