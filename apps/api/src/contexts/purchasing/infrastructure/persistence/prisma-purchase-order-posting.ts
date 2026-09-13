import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PurchaseOrderPosting } from '../../domain/order/posting/purchase-order-posting.js';
import { PurchaseOrder, PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { lockOrder, writeOrderState } from './prisma-order-writer.js';

@Injectable()
export class PrismaPurchaseOrderPosting implements PurchaseOrderPosting {
  constructor(private readonly prisma: PrismaService) {}

  async post(tenantId: TenantId, orderId: PurchaseOrderId, work: (order: PurchaseOrder) => void): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, tenantId.value, orderId.value);

      work(order);
      await writeOrderState(tx, order);
    });
  }
}
