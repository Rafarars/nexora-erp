import { SupplierId } from '../supplier.entity.js';
import { TenantId } from '../../shared/tenant-id.vo.js';

export const SUPPLIER_USAGE = Symbol('SupplierUsage');

// Lo que hace falta saber antes de cerrar a un proveedor. Mismo criterio que la bodega en el
// catalogo: un borrador no cuenta, porque todavia no prometio nada y se revalida al confirmarlo.
export interface SupplierUsage {
  hasOpenOrders(tenantId: TenantId, supplierId: SupplierId): Promise<boolean>;
}
