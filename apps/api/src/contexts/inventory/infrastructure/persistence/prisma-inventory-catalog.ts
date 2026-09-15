import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { InventoryCatalog, StockWarehouse, StockableItem } from '../../domain/catalog/inventory-catalog.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { toNumber } from './decimals.js';

// Lee las tablas de articulos y bodegas y las traduce al vocabulario de los ajustes. Para las
// bodegas es capa anticorrupcion: el unico archivo que sabe como las guarda el catalogo.
@Injectable()
export class PrismaInventoryCatalog implements InventoryCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async findItems(tenantId: TenantId, ids: ItemRef[]): Promise<StockableItem[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.item.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      include: { units: { include: { unit: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      type: row.type,
      isActive: row.isActive,
      units: row.units.map((unit) => ({
        unitId: unit.unitId,
        abbreviation: unit.unit.abbreviation,
        conversionFactor: toNumber(unit.conversionFactor),
        isBase: unit.isBase,
      })),
    }));
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<StockWarehouse[]> {
    if (ids.length === 0) return [];

    return this.prisma.warehouse.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      select: { id: true, name: true, isActive: true },
    });
  }
}
