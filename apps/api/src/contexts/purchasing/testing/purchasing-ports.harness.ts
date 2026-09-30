import { PurchaseOrderPosting } from '../domain/order/posting/purchase-order-posting.js';
import { PurchaseOrderRepository } from '../domain/order/purchase-order.repository.js';
import { GoodsReceiptRepository } from '../domain/receipt/goods-receipt.repository.js';
import { ReceiptPosting } from '../domain/receipt/posting/receipt-posting.js';
import { PurchaseReturnPosting } from '../domain/return/posting/purchase-return-posting.js';
import { PurchaseReturnRepository } from '../domain/return/purchase-return.repository.js';
import { InvoiceRevaluationPosting } from '../../../shared/prisma/invoice-revaluation-posting.js';
import { PurchaseInvoicePosting } from '../domain/invoice/posting/purchase-invoice-posting.js';
import { PurchaseInvoiceRepository } from '../domain/invoice/purchase-invoice.repository.js';
import { PurchasingCodeSequence } from '../domain/shared/code-sequence.js';
import { SupplierRepository } from '../domain/supplier/supplier.repository.js';

export interface PurchasingPorts {
  suppliers: SupplierRepository;
  orders: PurchaseOrderRepository;
  receipts: GoodsReceiptRepository;
  returns: PurchaseReturnRepository;
  invoices: PurchaseInvoiceRepository;
  orderPosting: PurchaseOrderPosting;
  receiptPosting: ReceiptPosting;
  returnPosting: PurchaseReturnPosting;
  invoicePosting: PurchaseInvoicePosting;
  revaluations?: InvoiceRevaluationPosting;
  codes: PurchasingCodeSequence;
}

// Deja compras vacio y garantiza las empresas, articulos, unidades y bodegas del object
// mother. Ademas deja ver y tocar la existencia, que en la base escribe el inventario.
export interface PurchasingPortsHarness {
  ports(): PurchasingPorts;
  stockOf(itemId: string, warehouseId: string): Promise<number>;
  averageCostOf(itemId: string, warehouseId: string): Promise<number>;
  adjustmentsOf(tenantId: string, invoiceId: string): Promise<Array<{ id: string; code: string; status: string; type: string; lines: Array<{ itemId: string; amount: number; direction: string }> }>>;
  // Simula que parte de la mercancia salio por otro documento.
  withdraw(itemId: string, warehouseId: string, quantity: number): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}
