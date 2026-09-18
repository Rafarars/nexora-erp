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
    // Los cobros aplican a facturas: primero ellos, o la clave ajena lo impide.
    await this.prisma.paymentAllocation.deleteMany();
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
    await this.prisma.codeSequence.deleteMany({ where: { prefix: 'AJU' } });

    for (const [id, slug] of [
      [TENANT_A, 'contract-inventory-a'],
      [TENANT_B, 'contract-inventory-b'],
    ]) {
      await this.prisma.tenant.upsert({ where: { id }, create: { id, name: slug, slug }, update: {} });
    }

    // Lo minimo del catalogo y del maestro de articulos a lo que apuntan las claves ajenas.
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

    // Activo en cada vuelta: una prueba lo desactiva.
    await this.prisma.item.upsert({
      where: { id: WATER },
      create: { id: WATER, tenantId: TENANT_A, code: 'ART900001', sku: 'CONTRATO-AGUA', name: 'Contrato agua', type: 'inventoried' },
      update: { isActive: true },
    });

    for (const [unitId, factor, isBase] of [
      [PIECE, 1, true],
      [BOX, 24, false],
    ] as const) {
      await this.prisma.itemUnit.upsert({
        where: { itemId_unitId: { itemId: WATER, unitId } },
        create: { tenantId: TENANT_A, itemId: WATER, unitId, conversionFactor: factor, isBase },
        update: {},
      });
    }
  }

  async deactivateItem(itemId: string): Promise<void> {
    await this.prisma.item.update({ where: { id: itemId }, data: { isActive: false } });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
