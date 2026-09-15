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
}
