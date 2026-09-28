import { TenantId } from '../shared/tenant-id.vo.js';
import { SalesReturn, SalesReturnId, SalesReturnStatus } from './sales-return.entity.js';

export const SALES_RETURN_REPOSITORY = Symbol('SalesReturnRepository');

export interface SalesReturnCriteria {
  customerId?: string;
  dispatchId?: string;
  status?: SalesReturnStatus;
  from?: string;
  to?: string;
  text?: string;
  limit: number;
  offset: number;
}

export interface SalesReturnRepository {
  find(tenantId: TenantId, id: SalesReturnId): Promise<SalesReturn | null>;
  save(returnEntity: SalesReturn): Promise<void>;
  searchPage(tenantId: TenantId, criteria: SalesReturnCriteria): Promise<{ returns: SalesReturn[]; total: number }>;
  // Cuanto se ha devuelto en devoluciones CONFIRMADAS para cada linea de un despacho.
  returnedQuantitiesByDispatch(tenantId: TenantId, dispatchId: string, excludeReturnId?: string): Promise<Map<string, number>>;
}
