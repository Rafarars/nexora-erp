import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import { SupplierUsage } from '../../domain/supplier/usage/supplier-usage.js';

export class InMemorySupplierUsage implements SupplierUsage {
  constructor(private readonly orders: PurchaseOrderRepository) {}

  async hasOpenOrders(tenantId: TenantId, supplierId: SupplierId): Promise<boolean> {
    const orders = await this.orders.searchByTenant(tenantId);

    return orders.some((order) => order.supplierId().equals(supplierId) && order.isReceivable());
  }
}
