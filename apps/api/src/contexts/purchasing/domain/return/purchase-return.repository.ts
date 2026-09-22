import { TenantId } from '../shared/tenant-id.vo.js';
import { PurchaseReturn, PurchaseReturnId, PurchaseReturnStatus } from './purchase-return.entity.js';

export const PURCHASE_RETURN_REPOSITORY = Symbol('PurchaseReturnRepository');

export interface PurchaseReturnCriteria {
  supplierId?: string;
  receiptId?: string;
  status?: PurchaseReturnStatus;
  from?: string;
  to?: string;
  text?: string;
  limit: number;
  offset: number;
}

export interface PurchaseReturnRepository {
  find(tenantId: TenantId, id: PurchaseReturnId): Promise<PurchaseReturn | null>;
  save(returnEntity: PurchaseReturn): Promise<void>;
  searchPage(tenantId: TenantId, criteria: PurchaseReturnCriteria): Promise<{ returns: PurchaseReturn[]; total: number }>;
  // Cuanto se ha devuelto en devoluciones CONFIRMADAS para cada linea de una recepcion.
  returnedQuantitiesByReceipt(tenantId: TenantId, receiptId: string, excludeReturnId?: string): Promise<Map<string, number>>;
}
