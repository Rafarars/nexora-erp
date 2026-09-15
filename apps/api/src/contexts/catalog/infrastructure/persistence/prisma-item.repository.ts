import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { DuplicateSkuError } from '../../domain/errors/duplicate.errors.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { Item } from '../../domain/item/item.entity.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { Sku } from '../../domain/item/sku.vo.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { violates } from '../../../../shared/prisma/unique-violation.js';

const WITH_UNITS = { units: true } as const;

type ItemRow = Awaited<ReturnType<PrismaService['item']['findFirstOrThrow']>> & {
  units: { unitId: string; conversionFactor: { toNumber(): number }; isBase: boolean }[];
};

export function itemFromRow(row: ItemRow): Item {
  return Item.fromPrimitives({
    ...row,
    units: row.units.map((unit) => ({
      unitId: unit.unitId,
      conversionFactor: unit.conversionFactor.toNumber(),
      isBase: unit.isBase,
    })),
  });
}

// El articulo y sus unidades dentro de la transaccion de quien llama. Las unidades se reemplazan
// enteras, porque la persona manda el conjunto completo y no una lista de cambios.
export async function writeItem(tx: TransactionClient, item: Item): Promise<void> {
  const { id, tenantId, code, sku, name, description, type, categoryId, taxId, isActive, units, createdAt, updatedAt } =
    item.toPrimitives();

  try {
    await tx.item.upsert({
      where: { tenantId_id: { tenantId, id } },
      create: { id, tenantId, code, sku, name, description, type, categoryId, taxId, isActive, createdAt, updatedAt },
      update: { sku, name, description, type, categoryId, taxId, isActive, updatedAt },
    });
    await tx.itemUnit.deleteMany({ where: { tenantId, itemId: id } });
    await tx.itemUnit.createMany({ data: units.map((unit) => ({ tenantId, itemId: id, ...unit })) });
  } catch (error) {
    if (violates(error, 'sku')) throw new DuplicateSkuError(sku, tenantId);
    throw error;
  }
}

@Injectable()
export class PrismaItemRepository implements ItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(item: Item): Promise<void> {
    await this.prisma.$transaction((tx) => writeItem(tx, item));
  }

  async find(tenantId: TenantId, id: ItemId): Promise<Item | null> {
    const row = await this.prisma.item.findFirst({
      where: { id: id.value, tenantId: tenantId.value },
      include: WITH_UNITS,
    });

    return row ? itemFromRow(row) : null;
  }

  async findBySku(tenantId: TenantId, sku: Sku): Promise<Item | null> {
    const row = await this.prisma.item.findFirst({
      where: { tenantId: tenantId.value, sku: sku.value },
      include: WITH_UNITS,
    });

    return row ? itemFromRow(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Item[]> {
    const rows = await this.prisma.item.findMany({
      where: { tenantId: tenantId.value },
      include: WITH_UNITS,
      orderBy: { name: 'asc' },
    });

    return rows.map(itemFromRow);
  }

  async hasActiveWithCategory(tenantId: TenantId, categoryId: CategoryId): Promise<boolean> {
    return this.exists({ tenantId: tenantId.value, isActive: true, categoryId: categoryId.value });
  }

  async hasActiveWithTax(tenantId: TenantId, taxId: TaxId): Promise<boolean> {
    return this.exists({ tenantId: tenantId.value, isActive: true, taxId: taxId.value });
  }

  async hasActiveWithUnit(tenantId: TenantId, unitId: MeasurementUnitId): Promise<boolean> {
    return this.exists({ tenantId: tenantId.value, isActive: true, units: { some: { unitId: unitId.value } } });
  }

  private async exists(where: NonNullable<Parameters<PrismaService['item']['findFirst']>[0]>['where']): Promise<boolean> {
    return (await this.prisma.item.findFirst({ where, select: { id: true } })) !== null;
  }
}
