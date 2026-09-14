import { CustomerRepository } from '../domain/customer/customer.repository.js';
import { DispatchRepository } from '../domain/dispatch/dispatch.repository.js';
import { DispatchPosting } from '../domain/dispatch/posting/dispatch-posting.js';
import { InvoiceRepository } from '../domain/invoice/invoice.repository.js';
import { InvoicePosting } from '../domain/invoice/posting/invoice-posting.js';
import { SalesOrderPosting } from '../domain/order/posting/sales-order-posting.js';
import { SalesOrderRepository } from '../domain/order/sales-order.repository.js';
import { SalesCodeSequence } from '../domain/shared/code-sequence.js';

export interface SalesPorts {
  customers: CustomerRepository;
  orders: SalesOrderRepository;
  dispatches: DispatchRepository;
  invoices: InvoiceRepository;
  orderPosting: SalesOrderPosting;
  dispatchPosting: DispatchPosting;
  invoicePosting: InvoicePosting;
  codes: SalesCodeSequence;
}

// Deja ventas vacio y garantiza empresas, articulos, unidades y bodegas. Ademas pone y lee la
// existencia, que en la base escribe el inventario.
export interface SalesPortsHarness {
  ports(): SalesPorts;
  stock(itemId: string, warehouseId: string, quantity: number): Promise<void>;
  stockOf(itemId: string, warehouseId: string): Promise<number>;
  reset(): Promise<void>;
  close(): Promise<void>;
}
