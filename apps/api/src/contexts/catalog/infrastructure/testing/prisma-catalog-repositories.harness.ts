import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { NOW, TENANT_A, TENANT_B, WAREHOUSE_A } from '../../domain/testing/catalog.mother.js';
import { CatalogRepositories, CatalogRepositoriesHarness, ItemCommitmentsSeeder } from '../../testing/catalog-repositories.harness.js';
import { PrismaCategoryRepository } from '../persistence/prisma-category.repository.js';
import { PrismaCodeSequence } from '../persistence/prisma-code-sequence.js';
import { PrismaItemPosting } from '../persistence/prisma-item-posting.js';
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

const SUPPLIER = 'd1111111-1111-4111-8111-111111111111';
const CUSTOMER = 'd2222222-2222-4222-8222-222222222222';

export class PrismaCatalogRepositoriesHarness implements CatalogRepositoriesHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  private sequence = 0;

  repositories(): CatalogRepositories {
    return {
      categories: new PrismaCategoryRepository(this.prisma),
      units: new PrismaMeasurementUnitRepository(this.prisma),
      taxes: new PrismaTaxRepository(this.prisma),
      warehouses: new PrismaWarehouseRepository(this.prisma),
      items: new PrismaItemRepository(this.prisma),
      itemPosting: new PrismaItemPosting(this.prisma),
      codes: new PrismaCodeSequence(this.prisma),
    };
  }

  // Filas reales de inventario, compras y ventas: la consulta de ItemPosting las lee con sus
  // estados y cantidades, y la base exige proveedor, cliente y bodega detras.
  commitments(): ItemCommitmentsSeeder {
    const prisma = this.prisma;
    const next = () => ++this.sequence;

    return {
      stock: async (itemId, quantity) => {
        await prisma.itemStock.upsert({
          where: { tenantId_itemId_warehouseId: { tenantId: TENANT_A, itemId, warehouseId: WAREHOUSE_A } },
          create: { tenantId: TENANT_A, itemId, warehouseId: WAREHOUSE_A, quantity, averageCost: 1, updatedAt: NOW },
          update: { quantity },
        });
      },
      movement: async (itemId) => {
        await prisma.inventoryMovement.create({
          data: {
            id: randomUUID(),
            tenantId: TENANT_A,
            itemId,
            warehouseId: WAREHOUSE_A,
            sequence: next(),
            direction: 'in',
            quantity: 1,
            unitCost: 1,
            balanceQuantity: 1,
            balanceAverageCost: 1,
            originType: 'adjustment',
            originId: randomUUID(),
            occurredAt: NOW,
          },
        });
      },
      purchaseLine: async ({ itemId, unitId, status, quantity, received }) => {
        await prisma.supplier.upsert({
          where: { id: SUPPLIER },
          create: { id: SUPPLIER, tenantId: TENANT_A, code: 'PRV000001', name: 'Proveedor del contrato' },
          update: {},
        });
        const orderId = randomUUID();

        await prisma.purchaseOrder.create({
          data: { id: orderId, tenantId: TENANT_A, code: `OC${String(next()).padStart(6, '0')}`, supplierId: SUPPLIER, warehouseId: WAREHOUSE_A, orderDate: NOW, status },
        });
        await prisma.purchaseOrderLine.create({
          data: { id: randomUUID(), tenantId: TENANT_A, orderId, lineNumber: 1, itemId, unitId, quantity, baseQuantity: quantity, unitCost: 1, receivedQuantity: received },
        });
      },
      salesLine: async ({ itemId, unitId, status, quantity, dispatched }) => {
        await prisma.customer.upsert({
          where: { id: CUSTOMER },
          create: { id: CUSTOMER, tenantId: TENANT_A, code: 'CLI000001', name: 'Cliente del contrato' },
          update: {},
        });
        const orderId = randomUUID();

        await prisma.salesOrder.create({
          data: { id: orderId, tenantId: TENANT_A, code: `PED${String(next()).padStart(6, '0')}`, customerId: CUSTOMER, warehouseId: WAREHOUSE_A, orderDate: NOW, status },
        });
        await prisma.salesOrderLine.create({
          data: { id: randomUUID(), tenantId: TENANT_A, orderId, lineNumber: 1, itemId, unitId, quantity, baseQuantity: quantity, unitPrice: 1, dispatchedQuantity: dispatched },
        });
      },
    };
  }

  // Escribe una unidad sin pasar por el dominio, para probar lo que garantiza la propia base.
  async insertUnit(row: { itemId: string; unitId: string; conversionFactor: number; isBase: boolean }): Promise<void> {
    await this.prisma.itemUnit.create({ data: { tenantId: TENANT_A, ...row } });
  }

  // Vacia el catalogo en el orden de las claves ajenas y garantiza que las dos
  // empresas existen: sin ellas, la base rechazaria cada fila.
  async reset(): Promise<void> {
    // El inventario apunta a articulos y bodegas: se vacia primero.
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
