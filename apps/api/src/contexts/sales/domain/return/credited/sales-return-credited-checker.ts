import { TenantId } from '../../shared/tenant-id.vo.js';
import { SalesReturnId } from '../sales-return.entity.js';

export interface SalesReturnCreditedChecker {
  isCredited(tenantId: TenantId, returnId: SalesReturnId): Promise<boolean>;
}

export const SALES_RETURN_CREDITED_CHECKER = Symbol('SalesReturnCreditedChecker');
