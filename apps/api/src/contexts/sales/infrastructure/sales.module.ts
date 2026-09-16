import { DOCUMENT_RATES } from '../../../shared/domain/ports/document-rates.js';
import type { DocumentRates } from '../../../shared/domain/ports/document-rates.js';
import { BUSINESS_CALENDAR } from '../../../shared/domain/ports/business-calendar.js';
import type { BusinessCalendar } from '../../../shared/domain/ports/business-calendar.js';
import { Module } from '@nestjs/common';
import type { Clock } from '../../../shared/domain/ports/clock.js';
import { CLOCK } from '../../../shared/domain/ports/clock.js';
import type { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { ID_GENERATOR } from '../../../shared/domain/ports/id-generator.js';
import { CompanyModule } from '../../company/infrastructure/company.module.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { InventoryModule } from '../../inventory/infrastructure/inventory.module.js';
import { ReceivablesModule } from '../../receivables/infrastructure/receivables.module.js';
import { DispatchCanceller } from '../application/cancel-dispatch/dispatch-canceller.js';
import { InvoiceCanceller } from '../application/cancel-invoice/invoice-canceller.js';
import { SalesOrderCanceller } from '../application/cancel-order/sales-order-canceller.js';
import { CustomerStatusChanger } from '../application/change-customer-status/customer-status-changer.js';
import { DispatchConfirmer } from '../application/confirm-dispatch/dispatch-confirmer.js';
import { SalesOrderConfirmer } from '../application/confirm-order/sales-order-confirmer.js';
import { CustomerCreator } from '../application/create-customer/customer-creator.js';
import { DispatchCreator } from '../application/create-dispatch/dispatch-creator.js';
import { SalesOrderCreator } from '../application/create-order/sales-order-creator.js';
import { InvoiceIssuer } from '../application/issue-invoice/invoice-issuer.js';
import { AvailabilitySearcher } from '../application/search-availability/availability-searcher.js';
import { CustomerSearcher } from '../application/search-customers/customer-searcher.js';
import { DispatchSearcher } from '../application/search-dispatches/dispatch-searcher.js';
import { InvoiceSearcher } from '../application/search-invoices/invoice-searcher.js';
import { SalesOrderSearcher } from '../application/search-orders/sales-order-searcher.js';
import { CustomerUpdater } from '../application/update-customer/customer-updater.js';
import { DispatchUpdater } from '../application/update-dispatch/dispatch-updater.js';
import { SalesOrderUpdater } from '../application/update-order/sales-order-updater.js';
import { SALES_CATALOG } from '../domain/catalog/sales-catalog.js';
import type { SalesCatalog } from '../domain/catalog/sales-catalog.js';
import { CustomerFinder } from '../domain/customer/find/customer-finder.js';
import { CUSTOMER_REPOSITORY } from '../domain/customer/customer.repository.js';
import type { CustomerRepository } from '../domain/customer/customer.repository.js';
import { CustomerUniqueness } from '../domain/customer/unique/customer-uniqueness.js';
import { DISPATCH_REPOSITORY } from '../domain/dispatch/dispatch.repository.js';
import type { DispatchRepository } from '../domain/dispatch/dispatch.repository.js';
import { DispatchFinder } from '../domain/dispatch/find/dispatch-finder.js';
import { DispatchLineFactory } from '../domain/dispatch/lines/dispatch-line-factory.js';
import { DispatchCancellation } from '../domain/dispatch/posting/dispatch-cancellation.js';
import { DispatchConfirmation } from '../domain/dispatch/posting/dispatch-confirmation.js';
import { DISPATCH_POSTING } from '../domain/dispatch/posting/dispatch-posting.js';
import type { DispatchPosting } from '../domain/dispatch/posting/dispatch-posting.js';
import { INVOICE_REPOSITORY } from '../domain/invoice/invoice.repository.js';
import type { InvoiceRepository } from '../domain/invoice/invoice.repository.js';
import { INVOICE_POSTING } from '../domain/invoice/posting/invoice-posting.js';
import type { InvoicePosting } from '../domain/invoice/posting/invoice-posting.js';
import { SalesOrderFinder } from '../domain/order/find/sales-order-finder.js';
import { SalesOrderReferences } from '../domain/order/lines/sales-order-references.js';
import { SALES_ORDER_POSTING } from '../domain/order/posting/sales-order-posting.js';
import type { SalesOrderPosting } from '../domain/order/posting/sales-order-posting.js';
import { StockReservation } from '../domain/order/posting/stock-reservation.js';
import { SALES_ORDER_REPOSITORY } from '../domain/order/sales-order.repository.js';
import type { SalesOrderRepository } from '../domain/order/sales-order.repository.js';
import { SALES_CODE_SEQUENCE } from '../domain/shared/code-sequence.js';
import type { SalesCodeSequence } from '../domain/shared/code-sequence.js';
import { SALES_STOCK } from '../domain/stock/sales-stock.js';
import type { SalesStock } from '../domain/stock/sales-stock.js';
import { CancelDispatchPutController } from './http/cancel-dispatch-put.controller.js';
import { CancelInvoicePutController } from './http/cancel-invoice-put.controller.js';
import { CancelSalesOrderPutController } from './http/cancel-sales-order-put.controller.js';
import { ChangeCustomerStatusPutController } from './http/change-customer-status-put.controller.js';
import { ConfirmDispatchPutController } from './http/confirm-dispatch-put.controller.js';
import { ConfirmSalesOrderPutController } from './http/confirm-sales-order-put.controller.js';
import { CreateCustomerPostController } from './http/create-customer-post.controller.js';
import { CreateDispatchPostController } from './http/create-dispatch-post.controller.js';
import { CreateSalesOrderPostController } from './http/create-sales-order-post.controller.js';
import { IssueInvoicePostController } from './http/issue-invoice-post.controller.js';
import { SearchAvailabilityGetController } from './http/search-availability-get.controller.js';
import { SearchCustomersGetController } from './http/search-customers-get.controller.js';
import { SearchDispatchesGetController } from './http/search-dispatches-get.controller.js';
import { SearchInvoicesGetController } from './http/search-invoices-get.controller.js';
import { SearchSalesOrdersGetController } from './http/search-sales-orders-get.controller.js';
import { UpdateCustomerPutController } from './http/update-customer-put.controller.js';
import { UpdateDispatchPutController } from './http/update-dispatch-put.controller.js';
import { UpdateSalesOrderPutController } from './http/update-sales-order-put.controller.js';
import { PrismaCustomerRepository } from './persistence/prisma-customer.repository.js';
import { PrismaDispatchPosting } from './persistence/prisma-dispatch-posting.js';
import { PrismaDispatchRepository } from './persistence/prisma-dispatch.repository.js';
import { PrismaInvoicePosting } from './persistence/prisma-invoice-posting.js';
import { PrismaInvoiceRepository } from './persistence/prisma-invoice.repository.js';
import { PrismaSalesCatalog } from './persistence/prisma-sales-catalog.js';
import { PrismaSalesCodeSequence } from './persistence/prisma-sales-code-sequence.js';
import { PrismaSalesOrderPosting } from './persistence/prisma-sales-order-posting.js';
import { PrismaSalesOrderRepository } from './persistence/prisma-sales-order.repository.js';
import { PrismaSalesStock } from './persistence/prisma-sales-stock.js';

// El cableado de ventas. Como compras, importa el modulo del inventario solo por
// DOCUMENT_STOCK_POSTING: reservar bloquea existencias y despachar las saca. Importa cuentas por
// cobrar solo por RECEIVABLE_BALANCES: facturar a credito y anular miran lo cobrado.
@Module({
  imports: [PrismaModule, SharedModule, CompanyModule, InventoryModule, ReceivablesModule],
  controllers: [
    SearchCustomersGetController,
    CreateCustomerPostController,
    UpdateCustomerPutController,
    ChangeCustomerStatusPutController,
    SearchSalesOrdersGetController,
    CreateSalesOrderPostController,
    UpdateSalesOrderPutController,
    ConfirmSalesOrderPutController,
    CancelSalesOrderPutController,
    SearchDispatchesGetController,
    CreateDispatchPostController,
    UpdateDispatchPutController,
    ConfirmDispatchPutController,
    CancelDispatchPutController,
    SearchInvoicesGetController,
    IssueInvoicePostController,
    CancelInvoicePutController,
    SearchAvailabilityGetController,
  ],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    { provide: SALES_ORDER_REPOSITORY, useClass: PrismaSalesOrderRepository },
    { provide: DISPATCH_REPOSITORY, useClass: PrismaDispatchRepository },
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository },
    { provide: SALES_ORDER_POSTING, useClass: PrismaSalesOrderPosting },
    { provide: DISPATCH_POSTING, useClass: PrismaDispatchPosting },
    { provide: INVOICE_POSTING, useClass: PrismaInvoicePosting },
    { provide: SALES_CATALOG, useClass: PrismaSalesCatalog },
    { provide: SALES_STOCK, useClass: PrismaSalesStock },
    { provide: SALES_CODE_SEQUENCE, useClass: PrismaSalesCodeSequence },

    { provide: CustomerFinder, useFactory: (r: CustomerRepository) => new CustomerFinder(r), inject: [CUSTOMER_REPOSITORY] },
    { provide: CustomerUniqueness, useFactory: (r: CustomerRepository) => new CustomerUniqueness(r), inject: [CUSTOMER_REPOSITORY] },
    { provide: SalesOrderFinder, useFactory: (r: SalesOrderRepository) => new SalesOrderFinder(r), inject: [SALES_ORDER_REPOSITORY] },
    { provide: DispatchFinder, useFactory: (r: DispatchRepository) => new DispatchFinder(r), inject: [DISPATCH_REPOSITORY] },
    {
      provide: SalesOrderReferences,
      useFactory: (c: CustomerFinder, k: SalesCatalog, i: IdGenerator) => new SalesOrderReferences(c, k, i),
      inject: [CustomerFinder, SALES_CATALOG, ID_GENERATOR],
    },
    { provide: DispatchLineFactory, useFactory: (k: SalesCatalog, i: IdGenerator) => new DispatchLineFactory(k, i), inject: [SALES_CATALOG, ID_GENERATOR] },
    { provide: StockReservation, useFactory: () => new StockReservation() },
    { provide: DispatchConfirmation, useFactory: () => new DispatchConfirmation() },
    { provide: DispatchCancellation, useFactory: () => new DispatchCancellation() },

    {
      provide: CustomerCreator,
      useFactory: (u: CustomerUniqueness, r: CustomerRepository, c: SalesCodeSequence, i: IdGenerator, k: Clock) => new CustomerCreator(u, r, c, i, k),
      inject: [CustomerUniqueness, CUSTOMER_REPOSITORY, SALES_CODE_SEQUENCE, ID_GENERATOR, CLOCK],
    },
    {
      provide: CustomerUpdater,
      useFactory: (f: CustomerFinder, u: CustomerUniqueness, r: CustomerRepository, k: Clock) => new CustomerUpdater(f, u, r, k),
      inject: [CustomerFinder, CustomerUniqueness, CUSTOMER_REPOSITORY, CLOCK],
    },
    {
      provide: CustomerStatusChanger,
      useFactory: (f: CustomerFinder, r: CustomerRepository, k: Clock) => new CustomerStatusChanger(f, r, k),
      inject: [CustomerFinder, CUSTOMER_REPOSITORY, CLOCK],
    },
    { provide: CustomerSearcher, useFactory: (r: CustomerRepository) => new CustomerSearcher(r), inject: [CUSTOMER_REPOSITORY] },

    {
      provide: SalesOrderCreator,
      useFactory: (x: SalesOrderReferences, r: SalesOrderRepository, c: SalesCodeSequence, i: IdGenerator, k: Clock, cal: BusinessCalendar, dr: DocumentRates) => new SalesOrderCreator(x, r, c, i, k, cal, dr),
      inject: [SalesOrderReferences, SALES_ORDER_REPOSITORY, SALES_CODE_SEQUENCE, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: SalesOrderUpdater,
      useFactory: (f: SalesOrderFinder, x: SalesOrderReferences, r: SalesOrderRepository, k: Clock, cal: BusinessCalendar, dr: DocumentRates) => new SalesOrderUpdater(f, x, r, k, cal, dr),
      inject: [SalesOrderFinder, SalesOrderReferences, SALES_ORDER_REPOSITORY, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: SalesOrderConfirmer,
      useFactory: (f: SalesOrderFinder, x: SalesOrderReferences, r: SalesOrderRepository, p: SalesOrderPosting, s: StockReservation, k: Clock, cal: BusinessCalendar, dr: DocumentRates) =>
        new SalesOrderConfirmer(f, x, r, p, s, k, cal, dr),
      inject: [SalesOrderFinder, SalesOrderReferences, SALES_ORDER_REPOSITORY, SALES_ORDER_POSTING, StockReservation, CLOCK, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    { provide: SalesOrderCanceller, useFactory: (p: SalesOrderPosting, k: Clock) => new SalesOrderCanceller(p, k), inject: [SALES_ORDER_POSTING, CLOCK] },
    {
      provide: SalesOrderSearcher,
      useFactory: (o: SalesOrderRepository, c: CustomerRepository, k: SalesCatalog) => new SalesOrderSearcher(o, c, k),
      inject: [SALES_ORDER_REPOSITORY, CUSTOMER_REPOSITORY, SALES_CATALOG],
    },

    {
      provide: DispatchCreator,
      useFactory: (o: SalesOrderFinder, f: DispatchLineFactory, r: DispatchRepository, c: SalesCodeSequence, i: IdGenerator, k: Clock, cal: BusinessCalendar) =>
        new DispatchCreator(o, f, r, c, i, k, cal),
      inject: [SalesOrderFinder, DispatchLineFactory, DISPATCH_REPOSITORY, SALES_CODE_SEQUENCE, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR],
    },
    {
      provide: DispatchUpdater,
      useFactory: (d: DispatchFinder, o: SalesOrderFinder, f: DispatchLineFactory, r: DispatchRepository, k: Clock, cal: BusinessCalendar) => new DispatchUpdater(d, o, f, r, k, cal),
      inject: [DispatchFinder, SalesOrderFinder, DispatchLineFactory, DISPATCH_REPOSITORY, CLOCK, BUSINESS_CALENDAR],
    },
    {
      provide: DispatchConfirmer,
      useFactory: (d: DispatchFinder, o: SalesOrderFinder, f: DispatchLineFactory, r: DispatchRepository, p: DispatchPosting, c: DispatchConfirmation, k: Clock, cal: BusinessCalendar) =>
        new DispatchConfirmer(d, o, f, r, p, c, k, cal),
      inject: [DispatchFinder, SalesOrderFinder, DispatchLineFactory, DISPATCH_REPOSITORY, DISPATCH_POSTING, DispatchConfirmation, CLOCK, BUSINESS_CALENDAR],
    },
    {
      provide: DispatchCanceller,
      useFactory: (p: DispatchPosting, c: DispatchCancellation, k: Clock) => new DispatchCanceller(p, c, k),
      inject: [DISPATCH_POSTING, DispatchCancellation, CLOCK],
    },
    {
      provide: DispatchSearcher,
      useFactory: (d: DispatchRepository, o: SalesOrderRepository, v: InvoiceRepository, c: CustomerRepository, k: SalesCatalog) => new DispatchSearcher(d, o, v, c, k),
      inject: [DISPATCH_REPOSITORY, SALES_ORDER_REPOSITORY, INVOICE_REPOSITORY, CUSTOMER_REPOSITORY, SALES_CATALOG],
    },

    {
      provide: InvoiceIssuer,
      useFactory: (d: DispatchFinder, o: SalesOrderFinder, v: InvoiceRepository, p: InvoicePosting, s: SalesCodeSequence, i: IdGenerator, k: Clock, cal: BusinessCalendar) =>
        new InvoiceIssuer(d, o, v, p, s, i, k, cal),
      inject: [DispatchFinder, SalesOrderFinder, INVOICE_REPOSITORY, INVOICE_POSTING, SALES_CODE_SEQUENCE, ID_GENERATOR, CLOCK, BUSINESS_CALENDAR],
    },
    { provide: InvoiceCanceller, useFactory: (p: InvoicePosting, k: Clock) => new InvoiceCanceller(p, k), inject: [INVOICE_POSTING, CLOCK] },
    {
      provide: InvoiceSearcher,
      useFactory: (v: InvoiceRepository, d: DispatchRepository, o: SalesOrderRepository, c: CustomerRepository, k: SalesCatalog) => new InvoiceSearcher(v, d, o, c, k),
      inject: [INVOICE_REPOSITORY, DISPATCH_REPOSITORY, SALES_ORDER_REPOSITORY, CUSTOMER_REPOSITORY, SALES_CATALOG],
    },
    {
      provide: AvailabilitySearcher,
      useFactory: (s: SalesStock, o: SalesOrderRepository, k: SalesCatalog) => new AvailabilitySearcher(s, o, k),
      inject: [SALES_STOCK, SALES_ORDER_REPOSITORY, SALES_CATALOG],
    },
  ],
})
export class SalesModule {}
