import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PurchaseWarehouse, PurchasableItem, PurchasingCatalog } from '../../domain/catalog/purchasing-catalog.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Capa anticorrupcion: lee las tablas del catalogo y las traduce al vocabulario de compras.
@Injectable()
export class PrismaPurchasingCatalog implements PurchasingCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async findItems(tenantId: TenantId, ids: ItemRef[]): Promise<PurchasableItem[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.item.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      include: { units: { include: { unit: true } }, purchaseTax: true },
    });

    return rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      type: row.type,
      isActive: row.isActive,
      // El de compra: un articulo puede comprarse exento y venderse con IVA.
      taxRate: row.purchaseTax ? row.purchaseTax.rate.toNumber() : 0,
      units: row.units.map((unit) => ({
        unitId: unit.unitId,
        abbreviation: unit.unit.abbreviation,
        conversionFactor: unit.conversionFactor.toNumber(),
        isBase: unit.isBase,
      })),
    }));
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<PurchaseWarehouse[]> {
    if (ids.length === 0) return [];

    return this.prisma.warehouse.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      select: { id: true, name: true, isActive: true },
    });
  }
}
