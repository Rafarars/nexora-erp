import { CustomerId } from '../customer.entity.js';
import { TenantId } from '../../shared/tenant-id.vo.js';

export const CUSTOMER_USAGE = Symbol('CustomerUsage');

// Lo que hace falta saber antes de cerrar a un cliente. Mismo criterio que la bodega del catalogo
// y el proveedor: un borrador no cuenta, porque se revalida al confirmarlo.
export interface CustomerUsage {
  hasOpenOrders(tenantId: TenantId, customerId: CustomerId): Promise<boolean>;
}
