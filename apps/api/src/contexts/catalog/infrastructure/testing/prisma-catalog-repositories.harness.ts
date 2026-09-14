import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TENANT_A, TENANT_B } from '../../domain/testing/catalog.mother.js';
import { CatalogRepositories, CatalogRepositoriesHarness } from '../../testing/catalog-repositories.harness.js';
import { PrismaCategoryRepository } from '../persistence/prisma-category.repository.js';
import { PrismaCodeSequence } from '../persistence/prisma-code-sequence.js';
import { PrismaItemRepository } from '../persistence/prisma-item.repository.js';
import { PrismaMeasurementUnitRepository } from '../persistence/prisma-measurement-unit.repository.js';
import { PrismaTaxRepository } from '../persistence/prisma-tax.repository.js';
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

  repositories(): CatalogRepositories {
    return {
      categories: new PrismaCategoryRepository(this.prisma),
      units: new PrismaMeasurementUnitRepository(this.prisma),
      taxes: new PrismaTaxRepository(this.prisma),
      warehouses: new PrismaWarehouseRepository(this.prisma),
      items: new PrismaItemRepository(this.prisma),
      codes: new PrismaCodeSequence(this.prisma),
    };
  }

  // Vacia el catalogo en el orden de las claves ajenas y garantiza que las dos
  // empresas existen: sin ellas, la base rechazaria cada fila.
  async reset(): Promise<void> {
    // El inventario apunta a articulos y bodegas: se vacia primero.
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
    await this.prisma.item.deleteMany();
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
