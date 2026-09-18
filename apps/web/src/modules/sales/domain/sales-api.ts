import type { Availability, Customer, Dispatch, Invoice, SalesOrder } from './sales';

export interface CustomerInput {
  name: string;
  fiscalId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermDays: number | null;
  creditLimit: number | null;
  priceListId: string | null;
}

export interface OrderInput {
  customerId: string;
  warehouseId: string;
  date: string | null;
  notes: string | null;
  currency: string | null;
  exchangeRate: number | null;
  priceListId: string | null;
  // Sin precio manda el de la lista, que resuelve el servidor.
  lines: { itemId: string; unitId: string; quantity: number; unitPrice: number | null }[];
}

export interface DispatchInput {
  date: string | null;
  notes: string | null;
  lines: { orderLineId: string; quantity: number }[];
}

export interface SalesApi {
  searchCustomers(token: string): Promise<Customer[]>;
  saveCustomer(token: string, id: string | null, input: CustomerInput): Promise<void>;
  changeCustomerStatus(token: string, id: string, active: boolean): Promise<void>;
  searchOrders(token: string): Promise<SalesOrder[]>;
  saveOrder(token: string, id: string | null, input: OrderInput): Promise<void>;
  confirmOrder(token: string, id: string): Promise<void>;
  cancelOrder(token: string, id: string): Promise<void>;
  searchDispatches(token: string): Promise<Dispatch[]>;
  createDispatch(token: string, orderId: string, input: DispatchInput): Promise<void>;
  updateDispatch(token: string, id: string, input: DispatchInput): Promise<void>;
  confirmDispatch(token: string, id: string): Promise<void>;
  cancelDispatch(token: string, id: string): Promise<void>;
  searchInvoices(token: string): Promise<Invoice[]>;
  issueInvoice(token: string, dispatchId: string): Promise<void>;
  cancelInvoice(token: string, id: string): Promise<void>;
  searchAvailability(token: string, warehouseId?: string): Promise<Availability[]>;
}
