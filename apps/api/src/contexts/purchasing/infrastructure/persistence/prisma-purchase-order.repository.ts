import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PurchaseOrderNotEditableError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrder, PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderCriteria, PurchaseOrderPage, PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
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
      const exists = await tx.purchaseOrder.findFirst({ where: { tenantId: row.tenantId, id: row.id }, select: { status: true } });

      if (!exists) {
        await tx.purchaseOrder.create({ data: { ...row, ...dates } });
      } else {
        const { count } = await tx.purchaseOrder.updateMany({
          where: { tenantId: row.tenantId, id: row.id, status: 'draft', updatedAt: order.version() ?? undefined },
          data: {
            supplierId: row.supplierId,
            warehouseId: row.warehouseId,
            ...dates,
            notes: row.notes,
            paymentTermDays: row.paymentTermDays,
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

  async searchPage(tenantId: TenantId, criteria: PurchaseOrderCriteria): Promise<PurchaseOrderPage> {
    const text = criteria.text;
    const where = {
      tenantId: tenantId.value,
      ...(criteria.supplierId ? { supplierId: criteria.supplierId } : {}),
      ...(criteria.warehouseId ? { warehouseId: criteria.warehouseId } : {}),
      ...(criteria.status ? { status: criteria.status } : {}),
      ...(criteria.from || criteria.to
        ? {
            orderDate: {
              ...(criteria.from ? { gte: new Date(`${criteria.from}T00:00:00.000Z`) } : {}),
              ...(criteria.to ? { lte: new Date(`${criteria.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
      ...(text
        ? {
            OR: [
              { code: { contains: text, mode: 'insensitive' as const } },
              { lines: { some: { itemSku: { contains: text, mode: 'insensitive' as const } } } },
              { lines: { some: { itemName: { contains: text, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({ where, include: { lines: true }, orderBy: { code: 'desc' }, take: criteria.limit, skip: criteria.offset }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { orders: rows.map(orderFromRow), total };
  }

  async searchOpen(tenantId: TenantId, warehouseId: string | null): Promise<PurchaseOrder[]> {
    const rows = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId: tenantId.value,
        status: { in: ['confirmed', 'partially_received'] },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: { lines: true },
      orderBy: { code: 'asc' },
    });

    return rows.map(orderFromRow);
  }
}
