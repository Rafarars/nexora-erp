import { SalesOrderNotFoundError } from '../../errors/sales.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { SalesOrder, SalesOrderId } from '../sales-order.entity.js';
import { SalesOrderRepository } from '../sales-order.repository.js';

export class SalesOrderFinder {
  constructor(private readonly orders: SalesOrderRepository) {}

  async find(tenantId: TenantId, id: SalesOrderId): Promise<SalesOrder> {
    const order = await this.orders.find(tenantId, id);

    if (!order) throw new SalesOrderNotFoundError(id.value);

    return order;
  }
}
