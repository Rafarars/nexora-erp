import { SalesOrderId } from '../order/sales-order.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { Dispatch, DispatchId } from './dispatch.entity.js';

export const DISPATCH_REPOSITORY = Symbol('DispatchRepository');

// Guarda borradores. Confirmar y anular pasan por DispatchPosting, que escribe el despacho junto
// con su pedido y la existencia.
export interface DispatchRepository {
  save(dispatch: Dispatch): Promise<void>;
  find(tenantId: TenantId, id: DispatchId): Promise<Dispatch | null>;
  searchByTenant(tenantId: TenantId, orderId?: SalesOrderId): Promise<Dispatch[]>;
}
