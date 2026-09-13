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
  lines: { itemId: string; unitId: string; quantity: number; unitCost: number }[];
}

export interface ReceiptInput {
  date: string | null;
  notes: string | null;
  lines: { orderLineId: string; quantity: number }[];
}

export interface PurchasingApi {
  searchSuppliers(token: string): Promise<Supplier[]>;
  saveSupplier(token: string, id: string | null, input: SupplierInput): Promise<void>;
  changeSupplierStatus(token: string, id: string, active: boolean): Promise<void>;
  searchOrders(token: string): Promise<PurchaseOrder[]>;
  saveOrder(token: string, id: string | null, input: OrderInput): Promise<void>;
  confirmOrder(token: string, id: string): Promise<void>;
  cancelOrder(token: string, id: string): Promise<void>;
  searchReceipts(token: string): Promise<GoodsReceipt[]>;
  createReceipt(token: string, orderId: string, input: ReceiptInput): Promise<void>;
  updateReceipt(token: string, id: string, input: ReceiptInput): Promise<void>;
  confirmReceipt(token: string, id: string): Promise<void>;
  cancelReceipt(token: string, id: string): Promise<void>;
  searchIncoming(token: string, warehouseId?: string): Promise<IncomingStock[]>;
}
