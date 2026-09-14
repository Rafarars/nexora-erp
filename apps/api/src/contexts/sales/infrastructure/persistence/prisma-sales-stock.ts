import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SalesStock } from '../../domain/stock/sales-stock.js';

// Ventas lee la existencia del inventario leyendo sus tablas, sin importar su codigo.
@Injectable()
export class PrismaSalesStock implements SalesStock {
  constructor(private readonly prisma: PrismaService) {}

  async onHand(tenantId: TenantId, warehouseId?: WarehouseRef): Promise<{ itemId: string; warehouseId: string; quantity: number }[]> {
    const rows = await this.prisma.itemStock.findMany({
      where: { tenantId: tenantId.value, ...(warehouseId ? { warehouseId: warehouseId.value } : {}) },
      select: { itemId: true, warehouseId: true, quantity: true },
    });

    return rows.map((row) => ({ itemId: row.itemId, warehouseId: row.warehouseId, quantity: row.quantity.toNumber() }));
  }
}
