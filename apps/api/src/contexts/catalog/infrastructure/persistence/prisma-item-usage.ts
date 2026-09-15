import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { ItemUsage } from '../../domain/usage/item-usage.js';

// El catalogo pregunta por los articulos leyendo sus tablas, sin importar el inventario.
@Injectable()
export class PrismaItemUsage implements ItemUsage {
  constructor(private readonly prisma: PrismaService) {}

  async activeItemUsesCategory(tenantId: TenantId, categoryId: CategoryId): Promise<boolean> {
    return this.exists({ tenantId: tenantId.value, isActive: true, categoryId: categoryId.value });
  }

  async activeItemUsesTax(tenantId: TenantId, taxId: TaxId): Promise<boolean> {
    return this.exists({ tenantId: tenantId.value, isActive: true, taxId: taxId.value });
  }

  async activeItemUsesUnit(tenantId: TenantId, unitId: MeasurementUnitId): Promise<boolean> {
    return this.exists({ tenantId: tenantId.value, isActive: true, units: { some: { unitId: unitId.value } } });
  }

  private async exists(where: NonNullable<Parameters<PrismaService['item']['findFirst']>[0]>['where']): Promise<boolean> {
    return (await this.prisma.item.findFirst({ where, select: { id: true } })) !== null;
  }
}
