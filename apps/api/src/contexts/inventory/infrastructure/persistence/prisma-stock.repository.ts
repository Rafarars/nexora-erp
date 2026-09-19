import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { InventoryMovement } from '../../domain/movement/inventory-movement.entity.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ItemStock } from '../../domain/stock/item-stock.entity.js';
import { StockCriteria, StockRepository } from '../../domain/stock/stock.repository.js';
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

  async searchPage(tenantId: TenantId, criteria: StockCriteria): Promise<{ stocks: ItemStock[]; total: number }> {
    const where: Prisma.ItemStockWhereInput = {
      tenantId: tenantId.value,
      ...(criteria.warehouseId ? { warehouseId: criteria.warehouseId } : {}),
      ...(criteria.includeEmpty ? {} : { quantity: { gt: 0 } }),
      ...(criteria.text
        ? {
            item: {
              OR: [
                { sku: { contains: criteria.text, mode: 'insensitive' as const } },
                { name: { contains: criteria.text, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.itemStock.findMany({
        where,
        // Por bodega y articulo, con la clave como desempate: dos nombres iguales no pueden
        // dejar una fila fuera de todas las paginas.
        orderBy: [{ warehouse: { name: 'asc' } }, { item: { name: 'asc' } }, { itemId: 'asc' }],
        take: criteria.limit,
        skip: criteria.offset,
      }),
      this.prisma.itemStock.count({ where }),
    ]);

    return { stocks: rows.map(stockFromRow), total };
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
