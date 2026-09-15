import { Injectable } from '@nestjs/common';
import { lockCatalogItems } from '../../../../shared/prisma/catalog-items.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { OrderedItems, PurchaseOrderPosting } from '../../domain/order/posting/purchase-order-posting.js';
import { PurchaseOrder, PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { lockOrder, writeOrderState } from './prisma-order-writer.js';

// En una transaccion: bloquea la orden y despues sus articulos en modo compartido, asi un cambio
// del articulo espera a que la orden se confirme o la confirmacion ve el cambio.
@Injectable()
export class PrismaPurchaseOrderPosting implements PurchaseOrderPosting {
  constructor(private readonly prisma: PrismaService) {}

  async post(tenantId: TenantId, orderId: PurchaseOrderId, work: (order: PurchaseOrder, items: OrderedItems) => void): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, tenantId.value, orderId.value);
      const locked = await lockCatalogItems(tx, tenantId.value, order.lines().map((line) => line.itemId.value));

      work(order, {
        item: (itemId) => {
          const item = locked.get(itemId.value);

          return item ? { isActive: item.isActive, type: item.type, factorOf: (unitId) => item.factorOf(unitId.value) } : null;
        },
      });
      await writeOrderState(tx, order);
    });
  }
}
