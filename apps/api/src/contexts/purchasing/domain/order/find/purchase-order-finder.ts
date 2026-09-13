import { PurchaseOrderNotFoundError } from '../../errors/purchasing.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { PurchaseOrder, PurchaseOrderId } from '../purchase-order.entity.js';
import { PurchaseOrderRepository } from '../purchase-order.repository.js';

export class PurchaseOrderFinder {
  constructor(private readonly orders: PurchaseOrderRepository) {}

  async find(tenantId: TenantId, id: PurchaseOrderId): Promise<PurchaseOrder> {
    const order = await this.orders.find(tenantId, id);

    if (!order) throw new PurchaseOrderNotFoundError(id.value);

    return order;
  }
}
