import { PurchaseOrderId } from '../order/purchase-order.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { GoodsReceipt, GoodsReceiptId } from './goods-receipt.entity.js';

export const GOODS_RECEIPT_REPOSITORY = Symbol('GoodsReceiptRepository');

// Guarda borradores: solo alcanza filas que siguen en borrador. Confirmar y anular pasan por
// ReceiptPosting, que escribe la entrada junto con su orden y la existencia.
export interface GoodsReceiptRepository {
  save(receipt: GoodsReceipt): Promise<void>;
  find(tenantId: TenantId, id: GoodsReceiptId): Promise<GoodsReceipt | null>;
  searchByTenant(tenantId: TenantId, orderId?: PurchaseOrderId): Promise<GoodsReceipt[]>;
}
