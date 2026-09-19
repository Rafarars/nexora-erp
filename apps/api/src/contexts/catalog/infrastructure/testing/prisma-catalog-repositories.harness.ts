import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TENANT_A, TENANT_B } from '../../domain/testing/catalog.mother.js';
import { CatalogRepositories, CatalogRepositoriesHarness, ItemSeeder, WarehouseSeeder } from '../../testing/catalog-repositories.harness.js';
import { PrismaCategoryRepository } from '../persistence/prisma-category.repository.js';
import { PrismaCodeSequence } from '../persistence/prisma-code-sequence.js';
import { PrismaItemUsage } from '../persistence/prisma-item-usage.js';
import { PrismaMeasurementUnitRepository } from '../persistence/prisma-measurement-unit.repository.js';
import { PrismaStockUsage } from '../persistence/prisma-stock-usage.js';
import { PrismaTaxRepository } from '../persistence/prisma-tax.repository.js';
import { PrismaPriceListCurrencies } from '../persistence/prisma-price-list-currencies.js';
import { PrismaPriceListRepository } from '../persistence/prisma-price-list.repository.js';
import { PrismaWarehouseRepository } from '../persistence/prisma-warehouse.repository.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');
  }

  return url;
}

export class PrismaCatalogRepositoriesHarness implements CatalogRepositoriesHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  private sequence = 0;

  repositories(): CatalogRepositories {
    return {
      categories: new PrismaCategoryRepository(this.prisma),
      units: new PrismaMeasurementUnitRepository(this.prisma),
      taxes: new PrismaTaxRepository(this.prisma),
      warehouses: new PrismaWarehouseRepository(this.prisma),
      priceLists: new PrismaPriceListRepository(this.prisma),
      currencies: new PrismaPriceListCurrencies(this.prisma),
      itemUsage: new PrismaItemUsage(this.prisma),
      stockUsage: new PrismaStockUsage(this.prisma),
      codes: new PrismaCodeSequence(this.prisma),
    };
  }

  // Filas reales de articulos, escritas sin el codigo del inventario: la consulta de ItemUsage
  // las lee con sus unidades. La primera unidad es la base.
  items(): ItemSeeder {
    const prisma = this.prisma;

    return {
      add: async ({ categoryId = null, salesTaxId = null, purchaseTaxId = null, unitIds = [], isActive = true }) => {
        const id = randomUUID();
        const number = ++this.sequence;

        await prisma.item.create({
          data: { id, tenantId: TENANT_A, code: `ART${900000 + number}`, sku: `CONTRATO-${number}`, name: `Contrato ${number}`, type: 'inventoried', categoryId, salesTaxId, purchaseTaxId, isActive },
        });
        await prisma.itemUnit.createMany({
          data: unitIds.map((unitId, index) => ({ tenantId: TENANT_A, itemId: id, unitId, conversionFactor: index === 0 ? 1 : 24, isBase: index === 0 })),
        });
      },
    };
  }

  // Filas reales de existencia y de documentos: la consulta que protege la bodega cruza las
  // tablas de compras y de ventas, asi que el contrato tiene que darle documentos de verdad.
  warehouseUsage(): WarehouseSeeder {
    const prisma = this.prisma;
    const party = async (kind: 'supplier' | 'customer'): Promise<string> => {
      const id = randomUUID();
      const number = ++this.sequence;
      const data = { id, tenantId: TENANT_A, code: `${kind === 'supplier' ? 'PRV' : 'CLI'}${900000 + number}`, name: `Contrato ${number}` };

      if (kind === 'supplier') await prisma.supplier.create({ data });
      else await prisma.customer.create({ data });

      return id;
    };

    return {
      stock: async (warehouseId, quantity) => {
        const item = randomUUID();
        const number = ++this.sequence;

        await prisma.item.create({
          data: { id: item, tenantId: TENANT_A, code: `ART${800000 + number}`, sku: `STOCK-${number}`, name: `Existencia ${number}`, type: 'inventoried' },
        });
        await prisma.itemStock.create({
          data: { tenantId: TENANT_A, itemId: item, warehouseId, quantity, averageCost: 1, lastSequence: 0, updatedAt: new Date('2026-01-01T00:00:00.000Z') },
        });
      },
      purchaseOrder: async (warehouseId, status) => {
        const number = ++this.sequence;

        await prisma.purchaseOrder.create({
          data: { id: randomUUID(), tenantId: TENANT_A, code: `OC${900000 + number}`, supplierId: await party('supplier'), warehouseId, orderDate: new Date('2026-01-01T00:00:00.000Z'), status, currency: 'USD', baseCurrency: 'USD' },
        });
      },
      salesOrder: async (warehouseId, status) => {
        const number = ++this.sequence;

        await prisma.salesOrder.create({
          data: { id: randomUUID(), tenantId: TENANT_A, code: `PED${900000 + number}`, customerId: await party('customer'), warehouseId, orderDate: new Date('2026-01-01T00:00:00.000Z'), status, currency: 'USD', baseCurrency: 'USD' },
        });
      },
    };
  }

  // Las monedas son un catalogo global, compartido por todas las empresas: se apaga y se restaura.
  async deactivateCurrency(code: string): Promise<() => Promise<void>> {
    await this.prisma.currency.update({ where: { code }, data: { isActive: false } });

    return async () => {
      await this.prisma.currency.update({ where: { code }, data: { isActive: true } });
    };
  }

  // Vacia el catalogo en el orden de las claves ajenas y garantiza que las dos
  // empresas existen: sin ellas, la base rechazaria cada fila.
  async reset(): Promise<void> {
    // Documentos, inventario y articulos apuntan al catalogo: se vacian primero.
    await this.prisma.customerPayment.deleteMany();
    await this.prisma.invoice.deleteMany();
    await this.prisma.dispatch.deleteMany();
    await this.prisma.salesOrder.deleteMany();
    await this.prisma.customer.deleteMany();
    await this.prisma.goodsReceipt.deleteMany();
    await this.prisma.purchaseOrder.deleteMany();
    await this.prisma.supplier.deleteMany();
    await this.prisma.inventoryMovement.updateMany({ data: { reversalOfId: null } });
    await this.prisma.inventoryMovement.deleteMany();
    await this.prisma.itemStock.deleteMany();
    await this.prisma.adjustment.deleteMany();
    await this.prisma.itemUnit.deleteMany();
    await this.prisma.itemPrice.deleteMany();
    await this.prisma.item.deleteMany();
    await this.prisma.priceList.deleteMany();
    await this.prisma.category.deleteMany();
    await this.prisma.tax.deleteMany();
    await this.prisma.measurementUnit.deleteMany();
    await this.prisma.warehouse.deleteMany();
    await this.prisma.codeSequence.deleteMany();

    for (const [id, slug] of [
      [TENANT_A, 'contract-catalog-a'],
      [TENANT_B, 'contract-catalog-b'],
    ]) {
      await this.prisma.tenant.upsert({ where: { id }, create: { id, name: slug, slug }, update: {} });
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
