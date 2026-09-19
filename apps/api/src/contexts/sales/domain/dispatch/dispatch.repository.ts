import { SalesOrderId } from '../order/sales-order.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { Dispatch, DispatchId, DispatchStatus } from './dispatch.entity.js';

export const DISPATCH_REPOSITORY = Symbol('DispatchRepository');

// Lo que la pantalla de despachos ofrece. `text` busca por codigo de despacho y de su pedido.
export interface DispatchCriteria {
  text: string | null;
  orderId: string | null;
  warehouseId: string | null;
  status: DispatchStatus | null;
  from: string | null;
  to: string | null;
  limit: number;
  offset: number;
}

export interface DispatchPage {
  dispatches: Dispatch[];
  total: number;
}

// Guarda borradores. Confirmar y anular pasan por DispatchPosting, que escribe el despacho junto
// con su pedido y la existencia.
export interface DispatchRepository {
  save(dispatch: Dispatch): Promise<void>;
  find(tenantId: TenantId, id: DispatchId): Promise<Dispatch | null>;
  searchByTenant(tenantId: TenantId, orderId?: SalesOrderId): Promise<Dispatch[]>;
  searchPage(tenantId: TenantId, criteria: DispatchCriteria): Promise<DispatchPage>;
}
