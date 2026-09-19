import type { GoodsReceipt, IncomingStock, PurchaseOrder, Supplier } from './purchasing';

export interface SupplierInput {
  name: string;
  fiscalId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermDays: number | null;
}

export interface OrderInput {
  supplierId: string;
  warehouseId: string;
  date: string | null;
  expectedDate: string | null;
  notes: string | null;
  currency: string | null;
  exchangeRate: number | null;
  lines: { itemId: string; unitId: string; quantity: number; unitCost: number }[];
}

export interface ReceiptInput {
  date: string | null;
  notes: string | null;
  exchangeRate: number | null;
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
export type SupplierFilters = { q?: string; active?: string; limit?: number; offset?: number };
export type OrderFilters = {
  q?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};
export type ReceiptFilters = {
  q?: string;
  orderId?: string;
  warehouseId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};
export type IncomingFilters = { q?: string; warehouseId?: string; limit?: number; offset?: number };

export interface SupplierPage extends Page {
  suppliers: Supplier[];
}

export interface OrderPage extends Page {
  orders: PurchaseOrder[];
}

export interface ReceiptPage extends Page {
  receipts: GoodsReceipt[];
}

export interface IncomingPage extends Page {
  incoming: IncomingStock[];
}

export interface PurchasingApi {
  searchSuppliers(token: string, filters?: SupplierFilters): Promise<SupplierPage>;
  // Todos, para llenar un selector: recorre las paginas que haga falta.
  allSuppliers(token: string): Promise<Supplier[]>;
  saveSupplier(token: string, id: string | null, input: SupplierInput): Promise<void>;
  changeSupplierStatus(token: string, id: string, active: boolean): Promise<void>;
  searchOrders(token: string, filters?: OrderFilters): Promise<OrderPage>;
  allOrders(token: string): Promise<PurchaseOrder[]>;
  saveOrder(token: string, id: string | null, input: OrderInput): Promise<void>;
  confirmOrder(token: string, id: string): Promise<void>;
  cancelOrder(token: string, id: string): Promise<void>;
  searchReceipts(token: string, filters?: ReceiptFilters): Promise<ReceiptPage>;
  createReceipt(token: string, orderId: string, input: ReceiptInput): Promise<void>;
  updateReceipt(token: string, id: string, input: ReceiptInput): Promise<void>;
  confirmReceipt(token: string, id: string): Promise<void>;
  cancelReceipt(token: string, id: string): Promise<void>;
  searchIncoming(token: string, filters?: IncomingFilters): Promise<IncomingPage>;
}
