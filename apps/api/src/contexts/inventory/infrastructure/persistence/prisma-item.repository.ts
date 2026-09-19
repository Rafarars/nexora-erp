import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { violates } from '../../../../shared/prisma/unique-violation.js';
import { DuplicateBarcodeError, DuplicateSkuError } from '../../domain/errors/item.errors.js';
import { Barcode } from '../../domain/item/barcode.vo.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { Item } from '../../domain/item/item.entity.js';
import { ItemCriteria, ItemRepository } from '../../domain/item/item.repository.js';
import { Sku } from '../../domain/item/sku.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

const WITH_UNITS = { units: true, reorderRules: true, prices: true } as const;

type Decimalish = { toNumber(): number };

type ItemRow = Awaited<ReturnType<PrismaService['item']['findFirstOrThrow']>> & {
  units: { unitId: string; conversionFactor: Decimalish; isBase: boolean }[];
  reorderRules: { warehouseId: string; minQuantity: Decimalish; maxQuantity: Decimalish | null; reorderQuantity: Decimalish }[];
  prices: { priceListId: string; price: Decimalish }[];
  minPrice: Decimalish | null;
};

export function itemFromRow(row: ItemRow): Item {
  return Item.fromPrimitives({
    ...row,
    units: row.units.map((unit) => ({
      unitId: unit.unitId,
      conversionFactor: unit.conversionFactor.toNumber(),
      isBase: unit.isBase,
    })),
    reorderRules: row.reorderRules.map((rule) => ({
      warehouseId: rule.warehouseId,
      minQuantity: rule.minQuantity.toNumber(),
      maxQuantity: rule.maxQuantity === null ? null : rule.maxQuantity.toNumber(),
      reorderQuantity: rule.reorderQuantity.toNumber(),
    })),
    prices: row.prices.map((price) => ({ priceListId: price.priceListId, price: price.price.toNumber() })),
    minPrice: row.minPrice === null ? null : row.minPrice.toNumber(),
  });
}

// El articulo y sus unidades dentro de la transaccion de quien llama. Las unidades se reemplazan
// enteras, porque la persona manda el conjunto completo y no una lista de cambios.
export async function writeItem(tx: TransactionClient, item: Item): Promise<void> {
  const { id, tenantId, code, sku, barcode, name, description, type, isPurchasable, isSellable, categoryId, salesTaxId, purchaseTaxId, minPrice, isActive, units, reorderRules, prices, createdAt, updatedAt } =
    item.toPrimitives();

  try {
    await tx.item.upsert({
      where: { tenantId_id: { tenantId, id } },
      create: { id, tenantId, code, sku, barcode, name, description, type, isPurchasable, isSellable, categoryId, salesTaxId, purchaseTaxId, minPrice, isActive, createdAt, updatedAt },
      update: { sku, barcode, name, description, type, isPurchasable, isSellable, categoryId, salesTaxId, purchaseTaxId, minPrice, isActive, updatedAt },
    });
    await tx.itemUnit.deleteMany({ where: { tenantId, itemId: id } });
    await tx.itemUnit.createMany({ data: units.map((unit) => ({ tenantId, itemId: id, ...unit })) });
    // Las reglas se reemplazan enteras, como las unidades: la persona manda el conjunto.
    await tx.itemReorderRule.deleteMany({ where: { tenantId, itemId: id } });
    await tx.itemReorderRule.createMany({ data: reorderRules.map((rule) => ({ tenantId, itemId: id, ...rule })) });
    // Los precios tambien: la persona manda la tabla completa de la pantalla del articulo.
    await tx.itemPrice.deleteMany({ where: { tenantId, itemId: id } });
    await tx.itemPrice.createMany({ data: prices.map((price) => ({ tenantId, itemId: id, ...price, updatedAt })) });
  } catch (error) {
    if (violates(error, 'sku')) throw new DuplicateSkuError(sku, tenantId);
    // La comprobacion previa tapa el caso normal; en una carrera manda el indice, y su choque
    // tiene que salir como el mismo 409 que veria la persona, no como un error del motor.
    if (barcode !== null && violates(error, 'barcode')) throw new DuplicateBarcodeError(barcode, tenantId);
    throw error;
  }
}

// Dos articulos pueden llamarse igual, y entonces el nombre no basta para ordenar: sin un
// desempate estable, una pagina repite lo que trajo la anterior y el articulo saltado no
// aparece en ninguna.
const ITEM_ORDER = [{ name: 'asc' as const }, { id: 'asc' as const }];

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

  async findByBarcode(tenantId: TenantId, barcode: Barcode): Promise<Item | null> {
    const row = await this.prisma.item.findFirst({
      where: { tenantId: tenantId.value, barcode: barcode.value },
      include: WITH_UNITS,
    });

    return row ? itemFromRow(row) : null;
  }

  async withReorderRules(tenantId: TenantId): Promise<Item[]> {
    const rows = await this.prisma.item.findMany({
      where: { tenantId: tenantId.value, reorderRules: { some: {} } },
      include: WITH_UNITS,
      orderBy: ITEM_ORDER,
    });

    return rows.map(itemFromRow);
  }

  async search(tenantId: TenantId, criteria: ItemCriteria): Promise<{ items: Item[]; total: number }> {
    const text = criteria.text;
    const where = {
      tenantId: tenantId.value,
      ...(text
        ? {
            OR: [
              { code: { contains: text, mode: 'insensitive' as const } },
              { sku: { contains: text, mode: 'insensitive' as const } },
              { name: { contains: text, mode: 'insensitive' as const } },
              { barcode: { contains: text, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.item.findMany({ where, include: WITH_UNITS, orderBy: ITEM_ORDER, take: criteria.limit, skip: criteria.offset }),
      this.prisma.item.count({ where }),
    ]);

    return { items: rows.map(itemFromRow), total };
  }
}
