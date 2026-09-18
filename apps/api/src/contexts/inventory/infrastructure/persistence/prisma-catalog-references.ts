import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  CatalogReferences,
  ReferencedCategory,
  ReferencedPriceList,
  ReferencedTax,
  ReferencedUnit,
  ReferencedWarehouse,
} from '../../domain/catalog/catalog-references.js';
import { CategoryRef, PriceListRef, TaxRef, UnitRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { toNumber } from './decimals.js';

// Capa anticorrupcion: lee las tablas del catalogo y las traduce al vocabulario del articulo,
// sin importar el contexto del catalogo.
@Injectable()
export class PrismaCatalogReferences implements CatalogReferences {
  constructor(private readonly prisma: PrismaService) {}

  async findCategories(tenantId: TenantId, ids: CategoryRef[]): Promise<ReferencedCategory[]> {
    if (ids.length === 0) return [];

    return this.prisma.category.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      select: { id: true, name: true, isActive: true },
    });
  }

  async findTaxes(tenantId: TenantId, ids: TaxRef[]): Promise<ReferencedTax[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.tax.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      select: { id: true, name: true, rate: true, isActive: true },
    });

    return rows.map((row) => ({ ...row, rate: toNumber(row.rate) }));
  }

  async findUnits(tenantId: TenantId, ids: UnitRef[]): Promise<ReferencedUnit[]> {
    if (ids.length === 0) return [];

    return this.prisma.measurementUnit.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      select: { id: true, name: true, abbreviation: true, isActive: true },
    });
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<ReferencedWarehouse[]> {
    if (ids.length === 0) return [];

    return this.prisma.warehouse.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      select: { id: true, name: true, isActive: true },
    });
  }

  async findPriceLists(tenantId: TenantId, ids: PriceListRef[]): Promise<ReferencedPriceList[]> {
    if (ids.length === 0) return [];

    return this.prisma.priceList.findMany({
      where: { tenantId: tenantId.value, id: { in: ids.map((id) => id.value) } },
      select: { id: true, name: true, currency: true, isActive: true },
    });
  }
}
