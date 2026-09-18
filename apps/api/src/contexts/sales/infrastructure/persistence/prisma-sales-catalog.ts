import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SalesPriceList, SalesWarehouse, SellableItem, SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { ItemRef, PriceListRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Capa anticorrupcion: lee las tablas del catalogo y las traduce al vocabulario de ventas.
@Injectable()
export class PrismaSalesCatalog implements SalesCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async findItems(tenantId: TenantId, ids: ItemRef[]): Promise<SellableItem[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.item.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      include: { units: { include: { unit: true } }, salesTax: true, prices: true },
    });

    return rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      type: row.type,
      isActive: row.isActive,
      isSellable: row.isSellable,
      taxRate: row.salesTax ? row.salesTax.rate.toNumber() : 0,
      units: row.units.map((unit) => ({
        unitId: unit.unitId,
        abbreviation: unit.unit.abbreviation,
        conversionFactor: unit.conversionFactor.toNumber(),
        isBase: unit.isBase,
      })),
      prices: row.prices.map((price) => ({ priceListId: price.priceListId, price: price.price.toNumber() })),
      minPrice: row.minPrice === null ? null : row.minPrice.toNumber(),
    }));
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<SalesWarehouse[]> {
    if (ids.length === 0) return [];

    return this.prisma.warehouse.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      select: { id: true, name: true, isActive: true },
    });
  }

  async findPriceList(tenantId: TenantId, id: PriceListRef): Promise<SalesPriceList | null> {
    return this.prisma.priceList.findFirst({
      where: { tenantId: tenantId.value, id: id.value },
      select: { id: true, name: true, currency: true, isActive: true },
    });
  }

  // Una lista por defecto apagada no existe para cotizar: la empresa no deja apagarla, pero el
  // adaptador no depende de esa regla.
  async findDefaultPriceList(tenantId: TenantId): Promise<SalesPriceList | null> {
    return this.prisma.priceList.findFirst({
      where: { tenantId: tenantId.value, isDefault: true, isActive: true },
      select: { id: true, name: true, currency: true, isActive: true },
    });
  }
}
