import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { StockUsage } from '../../domain/stock/stock-usage.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';

// El catalogo pregunta al inventario leyendo sus tablas, sin importar su codigo.
@Injectable()
export class PrismaStockUsage implements StockUsage {
  constructor(private readonly prisma: PrismaService) {}

  async warehouseHasStock(tenantId: TenantId, warehouseId: WarehouseId): Promise<boolean> {
    const row = await this.prisma.itemStock.findFirst({
      where: { tenantId: tenantId.value, warehouseId: warehouseId.value, quantity: { gt: 0 } },
      select: { itemId: true },
    });

    return row !== null;
  }

  // Confirmados y a medias, con pendiente: un borrador todavia no prometio nada.
  async warehouseHasOpenDocuments(tenantId: TenantId, warehouseId: WarehouseId): Promise<boolean> {
    const where = { tenantId: tenantId.value, warehouseId: warehouseId.value };
    const [purchase, sales] = await Promise.all([
      this.prisma.purchaseOrder.findFirst({
        where: { ...where, status: { in: ['confirmed', 'partially_received'] } },
        select: { id: true },
      }),
      this.prisma.salesOrder.findFirst({
        where: { ...where, status: { in: ['confirmed', 'partially_dispatched'] } },
        select: { id: true },
      }),
    ]);

    return purchase !== null || sales !== null;
  }
}
