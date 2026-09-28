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

interface Page {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Tipos y no interfaces: asi el cliente puede recorrerlos como pares clave-valor para
// armar la consulta. Los nombres son los que admite el esquema de cada ruta.
export type CustomerFilters = { q?: string; active?: string; limit?: number; offset?: number };
export type OrderFilters = {
  q?: string;
  customerId?: string;
  warehouseId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};
export type DispatchFilters = {
  q?: string;
  orderId?: string;
  warehouseId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};
export type InvoiceFilters = { q?: string; customerId?: string; status?: string; from?: string; to?: string; limit?: number; offset?: number };
export type AvailabilityFilters = { q?: string; warehouseId?: string; limit?: number; offset?: number };

export interface CustomerPage extends Page {
  customers: Customer[];
}

export interface OrderPage extends Page {
  orders: SalesOrder[];
}

export interface DispatchPage extends Page {
  dispatches: Dispatch[];
}

export interface InvoicePage extends Page {
  invoices: Invoice[];
}

export interface AvailabilityPage extends Page {
  availability: Availability[];
}

export interface SalesApi {
  searchCustomers(token: string, filters?: CustomerFilters): Promise<CustomerPage>;
  // Todos, para llenar un selector: recorre las paginas que haga falta.
  allCustomers(token: string): Promise<Customer[]>;
  saveCustomer(token: string, id: string | null, input: CustomerInput): Promise<void>;
  changeCustomerStatus(token: string, id: string, active: boolean): Promise<void>;
  searchOrders(token: string, filters?: OrderFilters): Promise<OrderPage>;
  allOrders(token: string): Promise<SalesOrder[]>;
  saveOrder(token: string, id: string | null, input: OrderInput): Promise<void>;
  confirmOrder(token: string, id: string): Promise<void>;
  cancelOrder(token: string, id: string): Promise<void>;
  searchDispatches(token: string, filters?: DispatchFilters): Promise<DispatchPage>;
  createDispatch(token: string, orderId: string, input: DispatchInput): Promise<void>;
  updateDispatch(token: string, id: string, input: DispatchInput): Promise<void>;
  confirmDispatch(token: string, id: string): Promise<void>;
  cancelDispatch(token: string, id: string): Promise<void>;
  searchInvoices(token: string, filters?: InvoiceFilters): Promise<InvoicePage>;
  issueInvoice(token: string, origin: { dispatchId: string } | { orderId: string }): Promise<void>;
  searchAvailability(token: string, filters?: AvailabilityFilters): Promise<AvailabilityPage>;
  searchReturns(token: string, filters?: SalesReturnFilters): Promise<SalesReturnPage>;
  createReturn(token: string, input: SalesReturnInput): Promise<{ id: string }>;
  updateReturn(token: string, id: string, input: Omit<SalesReturnInput, 'customerId' | 'dispatchId'>): Promise<void>;
  confirmReturn(token: string, id: string): Promise<void>;
  cancelReturn(token: string, id: string): Promise<void>;
  getDispatchReturnQuota(token: string, dispatchId: string): Promise<DispatchReturnQuota>;
}

export interface SalesReturnInput {
  customerId: string;
  dispatchId?: string | null;
  warehouseId?: string | null;
  currency?: string | null;
  exchangeRate?: number | null;
  date: string | null;
  condition: 'resalable' | 'damaged' | 'scrap';
  reason: string | null;
  notes: string | null;
  lines: {
    dispatchLineId?: string | null;
    itemId?: string;
    unitId?: string;
    quantity: number;
    unitCost?: number;
  }[];
}

export type SalesReturnFilters = {
  q?: string;
  customerId?: string;
  dispatchId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export interface SalesReturnPage extends Page {
  returns: import('./sales').SalesReturn[];
}

export interface DispatchReturnQuota {
  dispatchId: string;
  lines: {
    dispatchLineId: string;
    itemId: string;
    dispatchedQuantity: number;
    alreadyReturnedQuantity: number;
    availableToReturnQuantity: number;
  }[];
}

