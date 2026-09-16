import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PurchaseOrderNotEditableError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrder, PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, orderFromRow } from './purchasing-rows.js';

@Injectable()
export class PrismaPurchaseOrderRepository implements PurchaseOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Un borrador y sus lineas en una transaccion. Solo alcanza filas que SIGUEN en borrador:
  // si otra peticion la confirmo entre la lectura y esta escritura, se rechaza.
  async save(order: PurchaseOrder): Promise<void> {
    const { lines, orderDate, expectedDate, ...row } = order.toPrimitives();
    const dates = { orderDate: asDate(orderDate), expectedDate: expectedDate ? asDate(expectedDate) : null };

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.purchaseOrder.findFirst({ where: { tenantId: row.tenantId, id: row.id }, select: { status: true, updatedAt: true } });

      if (!exists) {
        await tx.purchaseOrder.create({ data: { ...row, ...dates } });
      } else {
        const { count } = await tx.purchaseOrder.updateMany({
          where: { tenantId: row.tenantId, id: row.id, status: 'draft', updatedAt: row.updatedAt },
          data: {
            supplierId: row.supplierId,
            warehouseId: row.warehouseId,
            ...dates,
            notes: row.notes,
            currency: row.currency,
            exchangeRate: row.exchangeRate,
            baseCurrency: row.baseCurrency,
            baseExchangeRate: row.baseExchangeRate,
            manualExchangeRate: row.manualExchangeRate,
            updatedAt: row.updatedAt,
          },
        });

        if (count === 0) {
          if (exists.status !== 'draft') throw new PurchaseOrderNotEditableError(row.id, exists.status);
          throw new ConcurrentModificationError(row.id);
        }

        await tx.purchaseOrderLine.deleteMany({ where: { tenantId: row.tenantId, orderId: row.id } });
      }

      await tx.purchaseOrderLine.createMany({
        data: lines.map((line) => ({ ...line, tenantId: row.tenantId, orderId: row.id })),
      });
    });
  }

  async find(tenantId: TenantId, id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    const row = await this.prisma.purchaseOrder.findFirst({ where: { tenantId: tenantId.value, id: id.value }, include: { lines: true } });

    return row ? orderFromRow(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<PurchaseOrder[]> {
    const rows = await this.prisma.purchaseOrder.findMany({
      where: { tenantId: tenantId.value },
      include: { lines: true },
      orderBy: { code: 'desc' },
    });

    return rows.map(orderFromRow);
  }
}
