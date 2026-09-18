import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SalesWarehouse, SellableItem, SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Capa anticorrupcion: lee las tablas del catalogo y las traduce al vocabulario de ventas.
@Injectable()
export class PrismaSalesCatalog implements SalesCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async findItems(tenantId: TenantId, ids: ItemRef[]): Promise<SellableItem[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.item.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      include: { units: { include: { unit: true } }, salesTax: true },
    });

    return rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      type: row.type,
      isActive: row.isActive,
      taxRate: row.salesTax ? row.salesTax.rate.toNumber() : 0,
      units: row.units.map((unit) => ({
        unitId: unit.unitId,
        abbreviation: unit.unit.abbreviation,
        conversionFactor: unit.conversionFactor.toNumber(),
        isBase: unit.isBase,
      })),
    }));
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<SalesWarehouse[]> {
    if (ids.length === 0) return [];

    return this.prisma.warehouse.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      select: { id: true, name: true, isActive: true },
    });
  }
}
