import { CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerUsage } from '../../domain/customer/usage/customer-usage.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryCustomerUsage implements CustomerUsage {
  constructor(private readonly orders: SalesOrderRepository) {}

  async hasOpenOrders(tenantId: TenantId, customerId: CustomerId): Promise<boolean> {
    const orders = await this.orders.searchByTenant(tenantId);

    return orders.some((order) => order.customerId().equals(customerId) && order.isDispatchable());
  }
}
