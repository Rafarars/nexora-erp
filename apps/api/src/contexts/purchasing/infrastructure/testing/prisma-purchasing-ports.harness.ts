import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
// El arnes compone el sistema de verdad como lo hace el modulo: compras con el inventario real
// detras de DOCUMENT_STOCK_POSTING. Es composicion de prueba, no dependencia del dominio.
import { PrismaDocumentStockPosting } from '../../../inventory/infrastructure/persistence/prisma-document-stock-posting.js';
import { BOX, MAIN, NORTH, PIECE, TENANT_A, TENANT_B, WATER } from '../../domain/testing/purchasing.mother.js';
import { PurchasingPorts, PurchasingPortsHarness } from '../../testing/purchasing-ports.harness.js';
import { PrismaGoodsReceiptRepository } from '../persistence/prisma-goods-receipt.repository.js';
import { PrismaPurchaseOrderPosting } from '../persistence/prisma-purchase-order-posting.js';
import { PrismaPurchaseOrderRepository } from '../persistence/prisma-purchase-order.repository.js';
import { PrismaPurchasingCodeSequence } from '../persistence/prisma-purchasing-code-sequence.js';
import { PrismaReceiptPosting } from '../persistence/prisma-receipt-posting.js';
import { PrismaSupplierRepository } from '../persistence/prisma-supplier.repository.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');

  return url;
}

export class PrismaPurchasingPortsHarness implements PurchasingPortsHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));

  ports(): PurchasingPorts {
    // Identificadores distintos a los del contrato del inventario, que usa la misma base.
    const ids = new SequentialIdGenerator();

    return {
      suppliers: new PrismaSupplierRepository(this.prisma),
      orders: new PrismaPurchaseOrderRepository(this.prisma),
      receipts: new PrismaGoodsReceiptRepository(this.prisma),
      orderPosting: new PrismaPurchaseOrderPosting(this.prisma),
      receiptPosting: new PrismaReceiptPosting(this.prisma, new PrismaDocumentStockPosting({ next: () => `9${ids.next().slice(1)}` })),
      codes: new PrismaPurchasingCodeSequence(this.prisma),
    };
  }

  async stockOf(itemId: string, warehouseId: string): Promise<number> {
    const row = await this.prisma.itemStock.findFirst({ where: { tenantId: TENANT_A, itemId, warehouseId } });

    return row ? row.quantity.toNumber() : 0;
  }

  // Resta la existencia sin kardex: solo para provocar que revertir no alcance.
  async withdraw(itemId: string, warehouseId: string, quantity: number): Promise<void> {
    await this.prisma.itemStock.updateMany({ where: { tenantId: TENANT_A, itemId, warehouseId }, data: { quantity: { decrement: quantity } } });
  }

  async reset(): Promise<void> {
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
    await this.prisma.codeSequence.deleteMany({ where: { prefix: { in: ['PRV', 'OC', 'ENT'] } } });

    for (const [id, slug] of [
      [TENANT_A, 'contract-purchasing-a'],
      [TENANT_B, 'contract-purchasing-b'],
    ]) {
      await this.prisma.tenant.upsert({ where: { id }, create: { id, name: slug, slug }, update: {} });
    }

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

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
