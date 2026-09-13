import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { BOX, MAIN, NORTH, PIECE, TENANT_A, TENANT_B, WATER } from '../../domain/testing/inventory.mother.js';
import { InventoryPorts, InventoryPortsHarness } from '../../testing/inventory-store.harness.js';
import { PrismaAdjustmentPosting } from '../persistence/prisma-adjustment-posting.js';
import { PrismaAdjustmentRepository } from '../persistence/prisma-adjustment.repository.js';
import { PrismaInventoryCodeSequence } from '../persistence/prisma-inventory-code-sequence.js';
import { PrismaStockRepository } from '../persistence/prisma-stock.repository.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');

  return url;
}

export class PrismaInventoryPortsHarness implements InventoryPortsHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));

  ports(): InventoryPorts {
    return {
      adjustments: new PrismaAdjustmentRepository(this.prisma),
      stocks: new PrismaStockRepository(this.prisma),
      posting: new PrismaAdjustmentPosting(this.prisma),
      codes: new PrismaInventoryCodeSequence(this.prisma),
    };
  }

  async reset(): Promise<void> {
    await this.prisma.inventoryMovement.updateMany({ data: { reversalOfId: null } });
    await this.prisma.inventoryMovement.deleteMany();
    await this.prisma.itemStock.deleteMany();
    await this.prisma.adjustment.deleteMany();
    await this.prisma.codeSequence.deleteMany({ where: { prefix: 'AJU' } });

    for (const [id, slug] of [
      [TENANT_A, 'contract-inventory-a'],
      [TENANT_B, 'contract-inventory-b'],
    ]) {
      await this.prisma.tenant.upsert({ where: { id }, create: { id, name: slug, slug }, update: {} });
    }

    // El catalogo minimo al que apuntan las claves ajenas del inventario.
    const unit = (id: string, code: string, name: string, abbreviation: string) =>
      this.prisma.measurementUnit.upsert({ where: { id }, create: { id, tenantId: TENANT_A, code, name, abbreviation }, update: {} });
    await unit(PIECE, 'UOM900001', 'Contrato unidad', 'cu');
    await unit(BOX, 'UOM900002', 'Contrato caja', 'cc');

    for (const [id, code, name] of [
      [MAIN, 'BOD900001', 'Contrato principal'],
      [NORTH, 'BOD900002', 'Contrato norte'],
    ]) {
      await this.prisma.warehouse.upsert({ where: { id }, create: { id, tenantId: TENANT_A, code, name }, update: {} });
    }

    await this.prisma.item.upsert({
      where: { id: WATER },
      create: { id: WATER, tenantId: TENANT_A, code: 'ART900001', sku: 'CONTRATO-AGUA', name: 'Contrato agua', type: 'inventoried' },
      update: {},
    });
    await this.prisma.itemUnit.upsert({
      where: { itemId_unitId: { itemId: WATER, unitId: PIECE } },
      create: { tenantId: TENANT_A, itemId: WATER, unitId: PIECE, conversionFactor: 1, isBase: true },
      update: {},
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
