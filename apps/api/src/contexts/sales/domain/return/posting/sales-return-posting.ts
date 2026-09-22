import { TenantId } from '../../shared/tenant-id.vo.js';
import { SalesReturn, SalesReturnId } from '../sales-return.entity.js';

export const SALES_RETURN_POSTING = Symbol('SalesReturnPosting');

export interface SalesReturnPosting {
  confirm(tenantId: TenantId, returnId: SalesReturnId, now: Date): Promise<SalesReturn>;
  cancel(tenantId: TenantId, returnId: SalesReturnId, now: Date): Promise<SalesReturn>;
}
