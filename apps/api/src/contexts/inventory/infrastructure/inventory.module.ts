import { Module } from '@nestjs/common';
import type { Clock } from '../../../shared/domain/ports/clock.js';
import { CLOCK } from '../../../shared/domain/ports/clock.js';
import type { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { ID_GENERATOR } from '../../../shared/domain/ports/id-generator.js';
import { DOCUMENT_STOCK_POSTING } from '../../../shared/prisma/document-stock-posting.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { AdjustmentCanceller } from '../application/cancel-adjustment/adjustment-canceller.js';
import { AdjustmentConfirmer } from '../application/confirm-adjustment/adjustment-confirmer.js';
import { AdjustmentCreator } from '../application/create-adjustment/adjustment-creator.js';
import { AdjustmentSearcher } from '../application/search-adjustments/adjustment-searcher.js';
import { MovementSearcher } from '../application/search-movements/movement-searcher.js';
import { StockSearcher } from '../application/search-stock/stock-searcher.js';
import { AdjustmentUpdater } from '../application/update-adjustment/adjustment-updater.js';
import { ADJUSTMENT_REPOSITORY } from '../domain/adjustment/adjustment.repository.js';
import type { AdjustmentRepository } from '../domain/adjustment/adjustment.repository.js';
import { AdjustmentFinder } from '../domain/adjustment/find/adjustment-finder.js';
import { AdjustmentLineFactory } from '../domain/adjustment/lines/adjustment-line-factory.js';
import { AdjustmentCancellation } from '../domain/adjustment/posting/adjustment-cancellation.js';
import { AdjustmentConfirmation } from '../domain/adjustment/posting/adjustment-confirmation.js';
import { ADJUSTMENT_POSTING } from '../domain/adjustment/posting/adjustment-posting.js';
import type { AdjustmentPosting } from '../domain/adjustment/posting/adjustment-posting.js';
import { MOVEMENT_DOCUMENTS } from '../domain/documents/movement-documents.js';
import type { MovementDocuments } from '../domain/documents/movement-documents.js';
import { StockMovements } from '../domain/stock/posting/stock-movements.js';
import { INVENTORY_CATALOG } from '../domain/catalog/inventory-catalog.js';
import type { InventoryCatalog } from '../domain/catalog/inventory-catalog.js';
import { INVENTORY_CODE_SEQUENCE } from '../domain/shared/code-sequence.js';
import type { InventoryCodeSequence } from '../domain/shared/code-sequence.js';
import { STOCK_REPOSITORY } from '../domain/stock/stock.repository.js';
import type { StockRepository } from '../domain/stock/stock.repository.js';
import { CancelAdjustmentPutController } from './http/cancel-adjustment-put.controller.js';
import { ConfirmAdjustmentPutController } from './http/confirm-adjustment-put.controller.js';
import { CreateAdjustmentPostController } from './http/create-adjustment-post.controller.js';
import { SearchAdjustmentsGetController } from './http/search-adjustments-get.controller.js';
import { SearchMovementsGetController } from './http/search-movements-get.controller.js';
import { SearchStockGetController } from './http/search-stock-get.controller.js';
import { UpdateAdjustmentPutController } from './http/update-adjustment-put.controller.js';
import { PrismaDocumentStockPosting } from './persistence/prisma-document-stock-posting.js';
import { PrismaMovementDocuments } from './persistence/prisma-movement-documents.js';
import { PrismaAdjustmentPosting } from './persistence/prisma-adjustment-posting.js';
import { PrismaAdjustmentRepository } from './persistence/prisma-adjustment.repository.js';
import { PrismaInventoryCatalog } from './persistence/prisma-inventory-catalog.js';
import { PrismaInventoryCodeSequence } from './persistence/prisma-inventory-code-sequence.js';
import { PrismaStockRepository } from './persistence/prisma-stock.repository.js';

// El cableado del inventario, con el mismo criterio que los otros contextos. Exporta solo
// la publicacion de documentos: es lo unico que otro contexto puede pedirle.
@Module({
  imports: [PrismaModule, SharedModule],
  controllers: [
    SearchAdjustmentsGetController,
    CreateAdjustmentPostController,
    UpdateAdjustmentPutController,
    ConfirmAdjustmentPutController,
    CancelAdjustmentPutController,
    SearchStockGetController,
    SearchMovementsGetController,
  ],
  providers: [
    { provide: ADJUSTMENT_REPOSITORY, useClass: PrismaAdjustmentRepository },
    { provide: STOCK_REPOSITORY, useClass: PrismaStockRepository },
    { provide: ADJUSTMENT_POSTING, useClass: PrismaAdjustmentPosting },
    { provide: INVENTORY_CATALOG, useClass: PrismaInventoryCatalog },
    { provide: INVENTORY_CODE_SEQUENCE, useClass: PrismaInventoryCodeSequence },
    { provide: MOVEMENT_DOCUMENTS, useClass: PrismaMovementDocuments },
    { provide: DOCUMENT_STOCK_POSTING, useClass: PrismaDocumentStockPosting },

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
      useFactory: (f: AdjustmentLineFactory, r: AdjustmentRepository, c: InventoryCodeSequence, i: IdGenerator, k: Clock) =>
        new AdjustmentCreator(f, r, c, i, k),
      inject: [AdjustmentLineFactory, ADJUSTMENT_REPOSITORY, INVENTORY_CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: AdjustmentUpdater,
      useFactory: (finder: AdjustmentFinder, f: AdjustmentLineFactory, r: AdjustmentRepository, k: Clock) =>
        new AdjustmentUpdater(finder, f, r, k),
      inject: [AdjustmentFinder, AdjustmentLineFactory, ADJUSTMENT_REPOSITORY, CLOCK],
    },
    {
      provide: AdjustmentConfirmer,
      useFactory: (
        finder: AdjustmentFinder,
        f: AdjustmentLineFactory,
        r: AdjustmentRepository,
        p: AdjustmentPosting,
        c: AdjustmentConfirmation,
        k: Clock,
      ) => new AdjustmentConfirmer(finder, f, r, p, c, k),
      inject: [AdjustmentFinder, AdjustmentLineFactory, ADJUSTMENT_REPOSITORY, ADJUSTMENT_POSTING, AdjustmentConfirmation, CLOCK],
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
      provide: MovementSearcher,
      useFactory: (s: StockRepository, d: MovementDocuments, c: InventoryCatalog) => new MovementSearcher(s, d, c),
      inject: [STOCK_REPOSITORY, MOVEMENT_DOCUMENTS, INVENTORY_CATALOG],
    },
  ],
  exports: [DOCUMENT_STOCK_POSTING],
})
export class InventoryModule {}
