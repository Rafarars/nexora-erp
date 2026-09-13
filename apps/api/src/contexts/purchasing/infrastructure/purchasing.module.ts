import { Module } from '@nestjs/common';
import type { Clock } from '../../../shared/domain/ports/clock.js';
import { CLOCK } from '../../../shared/domain/ports/clock.js';
import type { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { ID_GENERATOR } from '../../../shared/domain/ports/id-generator.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { InventoryModule } from '../../inventory/infrastructure/inventory.module.js';
import { PurchaseOrderCanceller } from '../application/cancel-order/purchase-order-canceller.js';
import { GoodsReceiptCanceller } from '../application/cancel-receipt/goods-receipt-canceller.js';
import { SupplierStatusChanger } from '../application/change-supplier-status/supplier-status-changer.js';
import { PurchaseOrderConfirmer } from '../application/confirm-order/purchase-order-confirmer.js';
import { GoodsReceiptConfirmer } from '../application/confirm-receipt/goods-receipt-confirmer.js';
import { PurchaseOrderCreator } from '../application/create-order/purchase-order-creator.js';
import { GoodsReceiptCreator } from '../application/create-receipt/goods-receipt-creator.js';
import { SupplierCreator } from '../application/create-supplier/supplier-creator.js';
import { IncomingStockSearcher } from '../application/search-incoming/incoming-stock-searcher.js';
import { PurchaseOrderSearcher } from '../application/search-orders/purchase-order-searcher.js';
import { GoodsReceiptSearcher } from '../application/search-receipts/goods-receipt-searcher.js';
import { SupplierSearcher } from '../application/search-suppliers/supplier-searcher.js';
import { PurchaseOrderUpdater } from '../application/update-order/purchase-order-updater.js';
import { GoodsReceiptUpdater } from '../application/update-receipt/goods-receipt-updater.js';
import { SupplierUpdater } from '../application/update-supplier/supplier-updater.js';
import { PURCHASING_CATALOG } from '../domain/catalog/purchasing-catalog.js';
import type { PurchasingCatalog } from '../domain/catalog/purchasing-catalog.js';
import { PurchaseOrderFinder } from '../domain/order/find/purchase-order-finder.js';
import { PurchaseOrderReferences } from '../domain/order/lines/purchase-order-references.js';
import { PURCHASE_ORDER_POSTING } from '../domain/order/posting/purchase-order-posting.js';
import type { PurchaseOrderPosting } from '../domain/order/posting/purchase-order-posting.js';
import { PURCHASE_ORDER_REPOSITORY } from '../domain/order/purchase-order.repository.js';
import type { PurchaseOrderRepository } from '../domain/order/purchase-order.repository.js';
import { GoodsReceiptFinder } from '../domain/receipt/find/goods-receipt-finder.js';
import { GOODS_RECEIPT_REPOSITORY } from '../domain/receipt/goods-receipt.repository.js';
import type { GoodsReceiptRepository } from '../domain/receipt/goods-receipt.repository.js';
import { GoodsReceiptLineFactory } from '../domain/receipt/lines/goods-receipt-line-factory.js';
import { ReceiptCancellation } from '../domain/receipt/posting/receipt-cancellation.js';
import { ReceiptConfirmation } from '../domain/receipt/posting/receipt-confirmation.js';
import { RECEIPT_POSTING } from '../domain/receipt/posting/receipt-posting.js';
import type { ReceiptPosting } from '../domain/receipt/posting/receipt-posting.js';
import { PURCHASING_CODE_SEQUENCE } from '../domain/shared/code-sequence.js';
import type { PurchasingCodeSequence } from '../domain/shared/code-sequence.js';
import { SupplierFinder } from '../domain/supplier/find/supplier-finder.js';
import { SUPPLIER_REPOSITORY } from '../domain/supplier/supplier.repository.js';
import type { SupplierRepository } from '../domain/supplier/supplier.repository.js';
import { SupplierUniqueness } from '../domain/supplier/unique/supplier-uniqueness.js';
import { CancelGoodsReceiptPutController } from './http/cancel-goods-receipt-put.controller.js';
import { CancelPurchaseOrderPutController } from './http/cancel-purchase-order-put.controller.js';
import { ChangeSupplierStatusPutController } from './http/change-supplier-status-put.controller.js';
import { ConfirmGoodsReceiptPutController } from './http/confirm-goods-receipt-put.controller.js';
import { ConfirmPurchaseOrderPutController } from './http/confirm-purchase-order-put.controller.js';
import { CreateGoodsReceiptPostController } from './http/create-goods-receipt-post.controller.js';
import { CreatePurchaseOrderPostController } from './http/create-purchase-order-post.controller.js';
import { CreateSupplierPostController } from './http/create-supplier-post.controller.js';
import { SearchGoodsReceiptsGetController } from './http/search-goods-receipts-get.controller.js';
import { SearchIncomingStockGetController } from './http/search-incoming-stock-get.controller.js';
import { SearchPurchaseOrdersGetController } from './http/search-purchase-orders-get.controller.js';
import { SearchSuppliersGetController } from './http/search-suppliers-get.controller.js';
import { UpdateGoodsReceiptPutController } from './http/update-goods-receipt-put.controller.js';
import { UpdatePurchaseOrderPutController } from './http/update-purchase-order-put.controller.js';
import { UpdateSupplierPutController } from './http/update-supplier-put.controller.js';
import { PrismaGoodsReceiptRepository } from './persistence/prisma-goods-receipt.repository.js';
import { PrismaPurchaseOrderPosting } from './persistence/prisma-purchase-order-posting.js';
import { PrismaPurchaseOrderRepository } from './persistence/prisma-purchase-order.repository.js';
import { PrismaPurchasingCatalog } from './persistence/prisma-purchasing-catalog.js';
import { PrismaPurchasingCodeSequence } from './persistence/prisma-purchasing-code-sequence.js';
import { PrismaReceiptPosting } from './persistence/prisma-receipt-posting.js';
import { PrismaSupplierRepository } from './persistence/prisma-supplier.repository.js';

// El cableado de compras. Importa el modulo del inventario por una sola razon: la
// publicacion de documentos que mueve existencia (DOCUMENT_STOCK_POSTING). Es el unico punto
// donde un contexto nombra a otro, y es composicion, no dependencia de su codigo.
@Module({
  imports: [PrismaModule, SharedModule, InventoryModule],
  controllers: [
    SearchSuppliersGetController,
    CreateSupplierPostController,
    UpdateSupplierPutController,
    ChangeSupplierStatusPutController,
    SearchPurchaseOrdersGetController,
    CreatePurchaseOrderPostController,
    UpdatePurchaseOrderPutController,
    ConfirmPurchaseOrderPutController,
    CancelPurchaseOrderPutController,
    SearchGoodsReceiptsGetController,
    CreateGoodsReceiptPostController,
    UpdateGoodsReceiptPutController,
    ConfirmGoodsReceiptPutController,
    CancelGoodsReceiptPutController,
    SearchIncomingStockGetController,
  ],
  providers: [
    { provide: SUPPLIER_REPOSITORY, useClass: PrismaSupplierRepository },
    { provide: PURCHASE_ORDER_REPOSITORY, useClass: PrismaPurchaseOrderRepository },
    { provide: GOODS_RECEIPT_REPOSITORY, useClass: PrismaGoodsReceiptRepository },
    { provide: PURCHASE_ORDER_POSTING, useClass: PrismaPurchaseOrderPosting },
    { provide: RECEIPT_POSTING, useClass: PrismaReceiptPosting },
    { provide: PURCHASING_CATALOG, useClass: PrismaPurchasingCatalog },
    { provide: PURCHASING_CODE_SEQUENCE, useClass: PrismaPurchasingCodeSequence },

    { provide: SupplierFinder, useFactory: (r: SupplierRepository) => new SupplierFinder(r), inject: [SUPPLIER_REPOSITORY] },
    { provide: SupplierUniqueness, useFactory: (r: SupplierRepository) => new SupplierUniqueness(r), inject: [SUPPLIER_REPOSITORY] },
    { provide: PurchaseOrderFinder, useFactory: (r: PurchaseOrderRepository) => new PurchaseOrderFinder(r), inject: [PURCHASE_ORDER_REPOSITORY] },
    { provide: GoodsReceiptFinder, useFactory: (r: GoodsReceiptRepository) => new GoodsReceiptFinder(r), inject: [GOODS_RECEIPT_REPOSITORY] },
    {
      provide: PurchaseOrderReferences,
      useFactory: (s: SupplierFinder, c: PurchasingCatalog, i: IdGenerator) => new PurchaseOrderReferences(s, c, i),
      inject: [SupplierFinder, PURCHASING_CATALOG, ID_GENERATOR],
    },
    {
      provide: GoodsReceiptLineFactory,
      useFactory: (c: PurchasingCatalog, i: IdGenerator) => new GoodsReceiptLineFactory(c, i),
      inject: [PURCHASING_CATALOG, ID_GENERATOR],
    },
    { provide: ReceiptConfirmation, useFactory: () => new ReceiptConfirmation() },
    { provide: ReceiptCancellation, useFactory: () => new ReceiptCancellation() },

    {
      provide: SupplierCreator,
      useFactory: (u: SupplierUniqueness, r: SupplierRepository, c: PurchasingCodeSequence, i: IdGenerator, k: Clock) =>
        new SupplierCreator(u, r, c, i, k),
      inject: [SupplierUniqueness, SUPPLIER_REPOSITORY, PURCHASING_CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: SupplierUpdater,
      useFactory: (f: SupplierFinder, u: SupplierUniqueness, r: SupplierRepository, k: Clock) => new SupplierUpdater(f, u, r, k),
      inject: [SupplierFinder, SupplierUniqueness, SUPPLIER_REPOSITORY, CLOCK],
    },
    {
      provide: SupplierStatusChanger,
      useFactory: (f: SupplierFinder, r: SupplierRepository, k: Clock) => new SupplierStatusChanger(f, r, k),
      inject: [SupplierFinder, SUPPLIER_REPOSITORY, CLOCK],
    },
    { provide: SupplierSearcher, useFactory: (r: SupplierRepository) => new SupplierSearcher(r), inject: [SUPPLIER_REPOSITORY] },

    {
      provide: PurchaseOrderCreator,
      useFactory: (x: PurchaseOrderReferences, r: PurchaseOrderRepository, c: PurchasingCodeSequence, i: IdGenerator, k: Clock) =>
        new PurchaseOrderCreator(x, r, c, i, k),
      inject: [PurchaseOrderReferences, PURCHASE_ORDER_REPOSITORY, PURCHASING_CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: PurchaseOrderUpdater,
      useFactory: (f: PurchaseOrderFinder, x: PurchaseOrderReferences, r: PurchaseOrderRepository, k: Clock) =>
        new PurchaseOrderUpdater(f, x, r, k),
      inject: [PurchaseOrderFinder, PurchaseOrderReferences, PURCHASE_ORDER_REPOSITORY, CLOCK],
    },
    {
      provide: PurchaseOrderConfirmer,
      useFactory: (f: PurchaseOrderFinder, x: PurchaseOrderReferences, r: PurchaseOrderRepository, p: PurchaseOrderPosting, k: Clock) =>
        new PurchaseOrderConfirmer(f, x, r, p, k),
      inject: [PurchaseOrderFinder, PurchaseOrderReferences, PURCHASE_ORDER_REPOSITORY, PURCHASE_ORDER_POSTING, CLOCK],
    },
    {
      provide: PurchaseOrderCanceller,
      useFactory: (p: PurchaseOrderPosting, k: Clock) => new PurchaseOrderCanceller(p, k),
      inject: [PURCHASE_ORDER_POSTING, CLOCK],
    },
    {
      provide: PurchaseOrderSearcher,
      useFactory: (o: PurchaseOrderRepository, s: SupplierRepository, c: PurchasingCatalog) => new PurchaseOrderSearcher(o, s, c),
      inject: [PURCHASE_ORDER_REPOSITORY, SUPPLIER_REPOSITORY, PURCHASING_CATALOG],
    },

    {
      provide: GoodsReceiptCreator,
      useFactory: (o: PurchaseOrderFinder, f: GoodsReceiptLineFactory, r: GoodsReceiptRepository, c: PurchasingCodeSequence, i: IdGenerator, k: Clock) =>
        new GoodsReceiptCreator(o, f, r, c, i, k),
      inject: [PurchaseOrderFinder, GoodsReceiptLineFactory, GOODS_RECEIPT_REPOSITORY, PURCHASING_CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: GoodsReceiptUpdater,
      useFactory: (g: GoodsReceiptFinder, o: PurchaseOrderFinder, f: GoodsReceiptLineFactory, r: GoodsReceiptRepository, k: Clock) =>
        new GoodsReceiptUpdater(g, o, f, r, k),
      inject: [GoodsReceiptFinder, PurchaseOrderFinder, GoodsReceiptLineFactory, GOODS_RECEIPT_REPOSITORY, CLOCK],
    },
    {
      provide: GoodsReceiptConfirmer,
      useFactory: (
        g: GoodsReceiptFinder,
        o: PurchaseOrderFinder,
        f: GoodsReceiptLineFactory,
        r: GoodsReceiptRepository,
        p: ReceiptPosting,
        c: ReceiptConfirmation,
        k: Clock,
      ) => new GoodsReceiptConfirmer(g, o, f, r, p, c, k),
      inject: [GoodsReceiptFinder, PurchaseOrderFinder, GoodsReceiptLineFactory, GOODS_RECEIPT_REPOSITORY, RECEIPT_POSTING, ReceiptConfirmation, CLOCK],
    },
    {
      provide: GoodsReceiptCanceller,
      useFactory: (p: ReceiptPosting, c: ReceiptCancellation, k: Clock) => new GoodsReceiptCanceller(p, c, k),
      inject: [RECEIPT_POSTING, ReceiptCancellation, CLOCK],
    },
    {
      provide: GoodsReceiptSearcher,
      useFactory: (r: GoodsReceiptRepository, o: PurchaseOrderRepository, s: SupplierRepository, c: PurchasingCatalog) =>
        new GoodsReceiptSearcher(r, o, s, c),
      inject: [GOODS_RECEIPT_REPOSITORY, PURCHASE_ORDER_REPOSITORY, SUPPLIER_REPOSITORY, PURCHASING_CATALOG],
    },
    {
      provide: IncomingStockSearcher,
      useFactory: (o: PurchaseOrderRepository, c: PurchasingCatalog) => new IncomingStockSearcher(o, c),
      inject: [PURCHASE_ORDER_REPOSITORY, PURCHASING_CATALOG],
    },
  ],
})
export class PurchasingModule {}
