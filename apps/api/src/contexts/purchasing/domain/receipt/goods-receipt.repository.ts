import { PurchaseOrderId } from '../order/purchase-order.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { GoodsReceipt, GoodsReceiptId, GoodsReceiptStatus } from './goods-receipt.entity.js';

export const GOODS_RECEIPT_REPOSITORY = Symbol('GoodsReceiptRepository');

// Lo que la pantalla de entradas ofrece. `text` busca por codigo de entrada y de su orden.
export interface GoodsReceiptCriteria {
  text: string | null;
  orderId: string | null;
  warehouseId: string | null;
  status: GoodsReceiptStatus | null;
  from: string | null;
  to: string | null;
  limit: number;
  offset: number;
}

export interface GoodsReceiptPage {
  receipts: GoodsReceipt[];
  total: number;
}

// Guarda borradores: solo alcanza filas que siguen en borrador. Confirmar y anular pasan por
// ReceiptPosting, que escribe la entrada junto con su orden y la existencia.
export interface GoodsReceiptRepository {
  save(receipt: GoodsReceipt): Promise<void>;
  find(tenantId: TenantId, id: GoodsReceiptId): Promise<GoodsReceipt | null>;
  searchByTenant(tenantId: TenantId, orderId?: PurchaseOrderId): Promise<GoodsReceipt[]>;
  searchPage(tenantId: TenantId, criteria: GoodsReceiptCriteria): Promise<GoodsReceiptPage>;
}
