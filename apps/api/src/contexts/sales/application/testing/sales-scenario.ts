import { FixedDocumentRates } from '../../../../shared/infrastructure/testing/fixed-document-rates.js';
import { ClockBusinessCalendar } from '../../../../shared/infrastructure/testing/clock-business-calendar.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { CustomerFinder } from '../../domain/customer/find/customer-finder.js';
import { CustomerUniqueness } from '../../domain/customer/unique/customer-uniqueness.js';
import { DispatchFinder } from '../../domain/dispatch/find/dispatch-finder.js';
import { DispatchLineFactory } from '../../domain/dispatch/lines/dispatch-line-factory.js';
import { DispatchCancellation } from '../../domain/dispatch/posting/dispatch-cancellation.js';
import { DispatchConfirmation } from '../../domain/dispatch/posting/dispatch-confirmation.js';
import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';
import { PriceListChoice } from '../../domain/order/pricing/price-list-choice.js';
import { SalesOrderReferences } from '../../domain/order/lines/sales-order-references.js';
import { InvoiceIssuance } from '../../domain/invoice/posting/invoice-issuance.js';
import { StockReservation } from '../../domain/order/posting/stock-reservation.js';
import { NOW, salesPriceLists, salesWarehouses, sellableItems } from '../../domain/testing/sales.mother.js';
import { InMemoryCustomerRepository } from '../../infrastructure/testing/in-memory-customer.repository.js';
import { InMemorySalesCatalog } from '../../infrastructure/testing/in-memory-sales-catalog.js';
import { InMemorySalesCodeSequence } from '../../infrastructure/testing/in-memory-sales-code-sequence.js';
import { InMemorySalesStore } from '../../infrastructure/testing/in-memory-sales-store.js';
import { DispatchCanceller } from '../cancel-dispatch/dispatch-canceller.js';
import { InvoiceCanceller } from '../cancel-invoice/invoice-canceller.js';
import { SalesOrderCanceller } from '../cancel-order/sales-order-canceller.js';
import { CustomerStatusChanger } from '../change-customer-status/customer-status-changer.js';
import { DispatchConfirmer } from '../confirm-dispatch/dispatch-confirmer.js';
import { SalesOrderConfirmer } from '../confirm-order/sales-order-confirmer.js';
import { CustomerCreator } from '../create-customer/customer-creator.js';
import { DispatchCreator } from '../create-dispatch/dispatch-creator.js';
import { SalesOrderCreator } from '../create-order/sales-order-creator.js';
import { InvoiceIssuer } from '../issue-invoice/invoice-issuer.js';
import { AvailabilitySearcher } from '../search-availability/availability-searcher.js';
import { CustomerSearcher } from '../search-customers/customer-searcher.js';
import { DispatchSearcher } from '../search-dispatches/dispatch-searcher.js';
import { InvoiceSearcher } from '../search-invoices/invoice-searcher.js';
import { SalesOrderSearcher } from '../search-orders/sales-order-searcher.js';
import { CustomerUpdater } from '../update-customer/customer-updater.js';
import { DispatchUpdater } from '../update-dispatch/dispatch-updater.js';
import { SalesOrderUpdater } from '../update-order/sales-order-updater.js';

// El mundo de una prueba de aplicacion de ventas: catalogo sembrado, almacen vacio, un
// inventario de juguete y reloj congelado. Sin base de datos ni NestJS.
export function aSalesScenario() {
  const clock = new FixedClock(NOW);
  const calendar = new ClockBusinessCalendar(clock);
  const ids = new SequentialIdGenerator();
  const customers = new InMemoryCustomerRepository();
  const catalog = new InMemorySalesCatalog(sellableItems(), salesWarehouses(), salesPriceLists());
  const store = new InMemorySalesStore(customers, catalog);
  const codes = new InMemorySalesCodeSequence();
  const customerFinder = new CustomerFinder(customers);
  const uniqueness = new CustomerUniqueness(customers);
  const references = new SalesOrderReferences(customerFinder, catalog, ids);
  const priceListChoice = new PriceListChoice(catalog);
  const rates = new FixedDocumentRates();
  const orderFinder = new SalesOrderFinder(store.orders);
  const dispatchFinder = new DispatchFinder(store.dispatches);
  const dispatchLines = new DispatchLineFactory(catalog, ids);

  return {
    clock,
    calendar,
    rates,
    customers,
    store,
    catalog,
    createCustomer: new CustomerCreator(uniqueness, customers, codes, ids, clock),
    updateCustomer: new CustomerUpdater(customerFinder, uniqueness, customers, clock),
    changeCustomerStatus: new CustomerStatusChanger(customerFinder, customers, clock),
    searchCustomers: new CustomerSearcher(customers),
    createOrder: new SalesOrderCreator(references, priceListChoice, store.orders, codes, ids, clock, calendar, rates),
    updateOrder: new SalesOrderUpdater(orderFinder, references, priceListChoice, store.orders, clock, calendar, rates),
    confirmOrder: new SalesOrderConfirmer(orderFinder, references, priceListChoice, store.orders, store.orderPosting, new StockReservation(), clock, calendar, rates),
    cancelOrder: new SalesOrderCanceller(store.orderPosting, clock),
    searchOrders: new SalesOrderSearcher(store.orders, customers, catalog, rates),
    createDispatch: new DispatchCreator(orderFinder, dispatchLines, store.dispatches, codes, ids, clock, calendar),
    updateDispatch: new DispatchUpdater(dispatchFinder, orderFinder, dispatchLines, store.dispatches, clock, calendar),
    confirmDispatch: new DispatchConfirmer(dispatchFinder, orderFinder, dispatchLines, store.dispatches, store.dispatchPosting, new DispatchConfirmation(), clock, calendar),
    cancelDispatch: new DispatchCanceller(store.dispatchPosting, new DispatchCancellation(), clock),
    searchDispatches: new DispatchSearcher(store.dispatches, store.orders, store.invoices, customers, catalog),
    issueInvoice: new InvoiceIssuer(dispatchFinder, orderFinder, store.invoices, store.invoicePosting, new InvoiceIssuance(), codes, ids, clock, calendar, rates),
    cancelInvoice: new InvoiceCanceller(store.invoicePosting, new InvoiceIssuance(), clock),
    searchInvoices: new InvoiceSearcher(store.invoices, store.dispatches, store.orders, customers, catalog),
    searchAvailability: new AvailabilitySearcher(store.salesStock, store.orders, catalog),
  };
}

export type SalesScenario = ReturnType<typeof aSalesScenario>;
