import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SalesOrderNotEditableError } from '../../domain/errors/sales.errors.js';
import { SalesOrder, SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { SalesOrderCriteria, SalesOrderPage, SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, orderFromRow } from './sales-rows.js';

@Injectable()
export class PrismaSalesOrderRepository implements SalesOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Un borrador y sus lineas en una transaccion. Solo alcanza filas que SIGUEN en borrador.
  async save(order: SalesOrder): Promise<void> {
    const { lines, orderDate, ...row } = order.toPrimitives();

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.salesOrder.findFirst({ where: { tenantId: row.tenantId, id: row.id }, select: { status: true } });

      if (!exists) {
        await tx.salesOrder.create({ data: { ...row, orderDate: asDate(orderDate) } });
      } else {
        const { count } = await tx.salesOrder.updateMany({
          where: { tenantId: row.tenantId, id: row.id, status: 'draft', updatedAt: order.version() ?? undefined },
          data: { customerId: row.customerId, warehouseId: row.warehouseId, orderDate: asDate(orderDate), notes: row.notes, currency: row.currency, exchangeRate: row.exchangeRate, baseCurrency: row.baseCurrency, baseExchangeRate: row.baseExchangeRate, manualExchangeRate: row.manualExchangeRate, updatedAt: row.updatedAt },
        });

        if (count === 0) {
          if (exists.status !== 'draft') throw new SalesOrderNotEditableError(row.id, exists.status);
          throw new ConcurrentModificationError(row.id);
        }

        await tx.salesOrderLine.deleteMany({ where: { tenantId: row.tenantId, orderId: row.id } });
      }

      await tx.salesOrderLine.createMany({ data: lines.map((line) => ({ ...line, tenantId: row.tenantId, orderId: row.id })) });
    });
  }

  async find(tenantId: TenantId, id: SalesOrderId): Promise<SalesOrder | null> {
    const row = await this.prisma.salesOrder.findFirst({ where: { tenantId: tenantId.value, id: id.value }, include: { lines: true } });

    return row ? orderFromRow(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<SalesOrder[]> {
    const rows = await this.prisma.salesOrder.findMany({ where: { tenantId: tenantId.value }, include: { lines: true }, orderBy: { code: 'desc' } });

    return rows.map(orderFromRow);
  }

  async searchPage(tenantId: TenantId, criteria: SalesOrderCriteria): Promise<SalesOrderPage> {
    const text = criteria.text;
    const where = {
      tenantId: tenantId.value,
      ...(criteria.customerId ? { customerId: criteria.customerId } : {}),
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
      this.prisma.salesOrder.findMany({ where, include: { lines: true }, orderBy: { code: 'desc' }, take: criteria.limit, skip: criteria.offset }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return { orders: rows.map(orderFromRow), total };
  }
}
