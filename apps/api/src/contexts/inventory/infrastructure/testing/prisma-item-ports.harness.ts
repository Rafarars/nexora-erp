import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { NOW, TENANT_A, TENANT_B, WAREHOUSE_A } from '../../domain/testing/item.mother.js';
import { CatalogSeeder, ItemCommitmentsSeeder, ItemPorts, ItemPortsHarness } from '../../testing/item-ports.harness.js';
import { PrismaCatalogReferences } from '../persistence/prisma-catalog-references.js';
import { PrismaItemPosting } from '../persistence/prisma-item-posting.js';
import { PrismaItemRepository } from '../persistence/prisma-item.repository.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');

  return url;
}

const SUPPLIER = 'd1111111-1111-4111-8111-111111111111';
const CUSTOMER = 'd2222222-2222-4222-8222-222222222222';

export class PrismaItemPortsHarness implements ItemPortsHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  private sequence = 0;

  ports(): ItemPorts {
    return {
      items: new PrismaItemRepository(this.prisma),
      posting: new PrismaItemPosting(this.prisma),
      catalog: new PrismaCatalogReferences(this.prisma),
    };
  }

  // Filas del catalogo escritas directamente: el inventario no usa el codigo del catalogo, ni
  // siquiera en sus pruebas.
  catalog(): CatalogSeeder {
    const prisma = this.prisma;
    const code = (prefix: string) => `${prefix}${String(900000 + ++this.sequence)}`;

    return {
      category: async ({ tenantId, id, name, isActive }) => {
        await prisma.category.create({ data: { id, tenantId, code: code('CAT'), name, isActive } });
      },
      tax: async ({ tenantId, id, name, rate, isActive }) => {
        await prisma.tax.create({ data: { id, tenantId, code: code('IMP'), name, rate, isActive } });
      },
      unit: async ({ tenantId, id, name, abbreviation, isActive }) => {
        await prisma.measurementUnit.create({ data: { id, tenantId, code: code('UOM'), name, abbreviation, isActive } });
      },
    };
  }

  // Filas reales de inventario, compras y ventas: la consulta de ItemPosting las lee con sus
  // estados y cantidades, y la base exige bodega, proveedor y cliente detras.
  commitments(): ItemCommitmentsSeeder {
    const prisma = this.prisma;
    const next = () => ++this.sequence;
    const warehouse = () =>
      prisma.warehouse.upsert({
        where: { id: WAREHOUSE_A },
        create: { id: WAREHOUSE_A, tenantId: TENANT_A, code: 'BOD900001', name: 'Bodega del contrato' },
        update: {},
      });

    return {
      stock: async (itemId, quantity) => {
        await warehouse();
        await prisma.itemStock.upsert({
          where: { tenantId_itemId_warehouseId: { tenantId: TENANT_A, itemId, warehouseId: WAREHOUSE_A } },
          create: { tenantId: TENANT_A, itemId, warehouseId: WAREHOUSE_A, quantity, averageCost: 1, updatedAt: NOW },
          update: { quantity },
        });
      },
      movement: async (itemId) => {
        await warehouse();
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
        await warehouse();
        await prisma.supplier.upsert({
          where: { id: SUPPLIER },
          create: { id: SUPPLIER, tenantId: TENANT_A, code: 'PRV000001', name: 'Proveedor del contrato' },
          update: {},
        });
        const orderId = randomUUID();

        await prisma.purchaseOrder.create({
          data: { id: orderId, tenantId: TENANT_A, code: `OC${String(next()).padStart(6, '0')}`, supplierId: SUPPLIER, warehouseId: WAREHOUSE_A, orderDate: NOW, status, currency: 'USD', baseCurrency: 'USD' },
        });
        await prisma.purchaseOrderLine.create({
          data: { id: randomUUID(), tenantId: TENANT_A, orderId, lineNumber: 1, itemId, itemSku: 'ARNES-SKU', itemName: 'Articulo del arnes', unitId, quantity, baseQuantity: quantity, unitCost: 1, receivedQuantity: received },
        });
      },
      salesLine: async ({ itemId, unitId, status, quantity, dispatched }) => {
        await warehouse();
        await prisma.customer.upsert({
          where: { id: CUSTOMER },
          create: { id: CUSTOMER, tenantId: TENANT_A, code: 'CLI000001', name: 'Cliente del contrato' },
          update: {},
        });
        const orderId = randomUUID();

        await prisma.salesOrder.create({
          data: { id: orderId, tenantId: TENANT_A, code: `PED${String(next()).padStart(6, '0')}`, customerId: CUSTOMER, warehouseId: WAREHOUSE_A, orderDate: NOW, status, currency: 'USD', baseCurrency: 'USD' },
        });
        await prisma.salesOrderLine.create({
          data: { id: randomUUID(), tenantId: TENANT_A, orderId, lineNumber: 1, itemId, itemSku: 'ARNES-SKU', itemName: 'Articulo del arnes', unitId, quantity, baseQuantity: quantity, unitPrice: 1, dispatchedQuantity: dispatched },
        });
      },
    };
  }

  // Escribe una unidad sin pasar por el dominio, para probar lo que garantiza la propia base.
  async insertUnit(row: { itemId: string; unitId: string; conversionFactor: number; isBase: boolean }): Promise<void> {
    await this.prisma.itemUnit.create({ data: { tenantId: TENANT_A, ...row } });
  }

  // Vacia en el orden de las claves ajenas y garantiza que las dos empresas existen: sin ellas,
  // la base rechazaria cada fila.
  async reset(): Promise<void> {
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
      [TENANT_A, 'contract-items-a'],
      [TENANT_B, 'contract-items-b'],
    ]) {
      await this.prisma.tenant.upsert({ where: { id }, create: { id, name: slug, slug }, update: {} });
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
