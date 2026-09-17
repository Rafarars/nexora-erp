import { ClockBusinessCalendar } from '../../../../shared/infrastructure/testing/clock-business-calendar.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { FixedDocumentRates } from '../../../../shared/infrastructure/testing/fixed-document-rates.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { PurchaseOrderFinder } from '../../domain/order/find/purchase-order-finder.js';
import { PurchaseOrderReferences } from '../../domain/order/lines/purchase-order-references.js';
import { GoodsReceiptFinder } from '../../domain/receipt/find/goods-receipt-finder.js';
import { GoodsReceiptLineFactory } from '../../domain/receipt/lines/goods-receipt-line-factory.js';
import { ReceiptCancellation } from '../../domain/receipt/posting/receipt-cancellation.js';
import { ReceiptConfirmation } from '../../domain/receipt/posting/receipt-confirmation.js';
import { SupplierFinder } from '../../domain/supplier/find/supplier-finder.js';
import { SupplierUniqueness } from '../../domain/supplier/unique/supplier-uniqueness.js';
import { NOW, purchasableItems, purchaseWarehouses } from '../../domain/testing/purchasing.mother.js';
import { InMemoryPurchasingCatalog } from '../../infrastructure/testing/in-memory-purchasing-catalog.js';
import { InMemoryPurchasingCodeSequence } from '../../infrastructure/testing/in-memory-purchasing-code-sequence.js';
import { InMemoryPurchasingStore } from '../../infrastructure/testing/in-memory-purchasing-store.js';
import { InMemorySupplierRepository } from '../../infrastructure/testing/in-memory-supplier.repository.js';
import { GoodsReceiptCanceller } from '../cancel-receipt/goods-receipt-canceller.js';
import { PurchaseOrderCanceller } from '../cancel-order/purchase-order-canceller.js';
import { SupplierStatusChanger } from '../change-supplier-status/supplier-status-changer.js';
import { GoodsReceiptConfirmer } from '../confirm-receipt/goods-receipt-confirmer.js';
import { PurchaseOrderConfirmer } from '../confirm-order/purchase-order-confirmer.js';
import { GoodsReceiptCreator } from '../create-receipt/goods-receipt-creator.js';
import { PurchaseOrderCreator } from '../create-order/purchase-order-creator.js';
import { SupplierCreator } from '../create-supplier/supplier-creator.js';
import { IncomingStockSearcher } from '../search-incoming/incoming-stock-searcher.js';
import { PurchaseOrderSearcher } from '../search-orders/purchase-order-searcher.js';
import { GoodsReceiptSearcher } from '../search-receipts/goods-receipt-searcher.js';
import { SupplierSearcher } from '../search-suppliers/supplier-searcher.js';
import { GoodsReceiptUpdater } from '../update-receipt/goods-receipt-updater.js';
import { PurchaseOrderUpdater } from '../update-order/purchase-order-updater.js';
import { SupplierUpdater } from '../update-supplier/supplier-updater.js';

// El mundo de una prueba de aplicacion de compras: catalogo sembrado, almacen vacio, un
// inventario de juguete y reloj congelado. Sin base de datos ni NestJS.
export function aPurchasingScenario() {
  const clock = new FixedClock(NOW);
  const calendar = new ClockBusinessCalendar(clock);
  const rates = new FixedDocumentRates();
  const ids = new SequentialIdGenerator();
  const suppliers = new InMemorySupplierRepository();
  const catalog = new InMemoryPurchasingCatalog(purchasableItems(), purchaseWarehouses());
  const store = new InMemoryPurchasingStore(catalog);
  const codes = new InMemoryPurchasingCodeSequence();
  const supplierFinder = new SupplierFinder(suppliers);
  const uniqueness = new SupplierUniqueness(suppliers);
  const references = new PurchaseOrderReferences(supplierFinder, catalog, ids);
  const orderFinder = new PurchaseOrderFinder(store.orders);
  const receiptFinder = new GoodsReceiptFinder(store.receipts);
  const receiptLines = new GoodsReceiptLineFactory(catalog, ids);

  return {
    clock,
    calendar,
    rates,
    suppliers,
    store,
    catalog,
    createSupplier: new SupplierCreator(uniqueness, suppliers, codes, ids, clock),
    updateSupplier: new SupplierUpdater(supplierFinder, uniqueness, suppliers, clock),
    changeSupplierStatus: new SupplierStatusChanger(supplierFinder, suppliers, clock),
    searchSuppliers: new SupplierSearcher(suppliers),
    createOrder: new PurchaseOrderCreator(references, store.orders, codes, ids, clock, calendar, rates),
    updateOrder: new PurchaseOrderUpdater(orderFinder, references, store.orders, clock, calendar, rates),
    confirmOrder: new PurchaseOrderConfirmer(orderFinder, references, store.orders, store.orderPosting, clock, calendar, rates),
    cancelOrder: new PurchaseOrderCanceller(store.orderPosting, clock),
    searchOrders: new PurchaseOrderSearcher(store.orders, suppliers, catalog, rates),
    createReceipt: new GoodsReceiptCreator(orderFinder, receiptLines, store.receipts, codes, ids, clock, calendar, rates),
    updateReceipt: new GoodsReceiptUpdater(receiptFinder, orderFinder, receiptLines, store.receipts, clock, calendar, rates),
    confirmReceipt: new GoodsReceiptConfirmer(receiptFinder, orderFinder, receiptLines, store.receipts, store.receiptPosting, new ReceiptConfirmation(), clock, calendar, rates),
    cancelReceipt: new GoodsReceiptCanceller(store.receiptPosting, new ReceiptCancellation(), clock),
    searchReceipts: new GoodsReceiptSearcher(store.receipts, store.orders, suppliers, catalog),
    searchIncoming: new IncomingStockSearcher(store.orders, catalog),
  };
}

export type PurchasingScenario = ReturnType<typeof aPurchasingScenario>;
