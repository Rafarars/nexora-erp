import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { InventoryMovement } from '../../domain/movement/inventory-movement.entity.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ItemStock } from '../../domain/stock/item-stock.entity.js';
import { StockRepository } from '../../domain/stock/stock.repository.js';
import { movementFromRow, stockFromRow } from './inventory-rows.js';

@Injectable()
export class PrismaStockRepository implements StockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchStocks(tenantId: TenantId, warehouseId?: WarehouseRef): Promise<ItemStock[]> {
    const rows = await this.prisma.itemStock.findMany({
      where: { tenantId: tenantId.value, ...(warehouseId ? { warehouseId: warehouseId.value } : {}) },
    });

    return rows.map(stockFromRow);
  }

  async searchMovements(tenantId: TenantId, itemId: ItemRef, warehouseId?: WarehouseRef): Promise<InventoryMovement[]> {
    const rows = await this.prisma.inventoryMovement.findMany({
      where: {
        tenantId: tenantId.value,
        itemId: itemId.value,
        ...(warehouseId ? { warehouseId: warehouseId.value } : {}),
      },
      orderBy: [{ warehouseId: 'asc' }, { sequence: 'asc' }],
    });

    return rows.map(movementFromRow);
  }
}
