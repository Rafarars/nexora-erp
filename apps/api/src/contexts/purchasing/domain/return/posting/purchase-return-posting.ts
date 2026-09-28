import { TenantId } from '../../shared/tenant-id.vo.js';
import { PurchaseReturn, PurchaseReturnId } from '../purchase-return.entity.js';

export const PURCHASE_RETURN_POSTING = Symbol('PurchaseReturnPosting');

export interface PurchaseReturnPosting {
  confirm(tenantId: TenantId, returnId: PurchaseReturnId, now: Date): Promise<PurchaseReturn>;
  cancel(tenantId: TenantId, returnId: PurchaseReturnId, now: Date): Promise<PurchaseReturn>;
}
