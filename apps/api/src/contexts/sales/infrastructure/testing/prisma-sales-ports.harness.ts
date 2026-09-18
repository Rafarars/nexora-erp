import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
// El arnes compone el sistema de verdad como lo hace el modulo: ventas con el inventario real
// detras de DOCUMENT_STOCK_POSTING y
// cuentas por cobrar detras de RECEIVABLE_BALANCES. Es composicion de prueba, no dependencia del dominio.
import { PrismaDocumentStockPosting } from '../../../inventory/infrastructure/persistence/prisma-document-stock-posting.js';
import { PrismaReceivableBalances } from '../../../receivables/infrastructure/persistence/prisma-receivable-balances.js';
import { BOX, MAIN, NORTH, PIECE, RETAIL_LIST, TENANT_A, TENANT_B, WATER } from '../../domain/testing/sales.mother.js';
import { SalesPorts, SalesPortsHarness } from '../../testing/sales-ports.harness.js';
import { PrismaCustomerRepository } from '../persistence/prisma-customer.repository.js';
import { PrismaDispatchPosting } from '../persistence/prisma-dispatch-posting.js';
import { PrismaDispatchRepository } from '../persistence/prisma-dispatch.repository.js';
import { PrismaInvoicePosting } from '../persistence/prisma-invoice-posting.js';
import { PrismaInvoiceRepository } from '../persistence/prisma-invoice.repository.js';
import { PrismaSalesCodeSequence } from '../persistence/prisma-sales-code-sequence.js';
import { PrismaSalesOrderPosting } from '../persistence/prisma-sales-order-posting.js';
import { PrismaSalesOrderRepository } from '../persistence/prisma-sales-order.repository.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');

  return url;
}

export class PrismaSalesPortsHarness implements SalesPortsHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));

  ports(): SalesPorts {
    const ids = new SequentialIdGenerator();
    const stock = new PrismaDocumentStockPosting({ next: () => `8${ids.next().slice(1)}` });

    return {
      customers: new PrismaCustomerRepository(this.prisma),
      orders: new PrismaSalesOrderRepository(this.prisma),
      dispatches: new PrismaDispatchRepository(this.prisma),
      invoices: new PrismaInvoiceRepository(this.prisma),
      orderPosting: new PrismaSalesOrderPosting(this.prisma, stock),
      dispatchPosting: new PrismaDispatchPosting(this.prisma, stock),
      invoicePosting: new PrismaInvoicePosting(this.prisma, new PrismaReceivableBalances()),
      codes: new PrismaSalesCodeSequence(this.prisma),
    };
  }

  // Pone la existencia sin kardex: la prueba parte de una cantidad conocida.
  async stock(itemId: string, warehouseId: string, quantity: number): Promise<void> {
    await this.prisma.itemStock.upsert({
      where: { tenantId_itemId_warehouseId: { tenantId: TENANT_A, itemId, warehouseId } },
      create: { tenantId: TENANT_A, itemId, warehouseId, quantity, averageCost: 1, lastSequence: 0, updatedAt: new Date() },
      update: { quantity },
    });
  }

  async stockOf(itemId: string, warehouseId: string): Promise<number> {
    const row = await this.prisma.itemStock.findFirst({ where: { tenantId: TENANT_A, itemId, warehouseId } });

    return row ? row.quantity.toNumber() : 0;
  }

  async pay(invoiceId: string, customerId: string, amount: number): Promise<void> {
    const id = crypto.randomUUID();

    await this.prisma.customerPayment.create({
      data: {
        id,
        tenantId: TENANT_A,
        code: `COB${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
        customerId,
        paymentDate: new Date('2026-01-15T00:00:00.000Z'),
        method: 'cash',
        amount,
        status: 'confirmed', currency: 'USD', baseCurrency: 'USD', exchangeRate: 36.5, baseExchangeRate: 36.5, manualExchangeRate: false, amountVes: amount * 36.5,
        updatedAt: new Date(),
      },
    });
    await this.prisma.paymentAllocation.create({ data: { id: crypto.randomUUID(), tenantId: TENANT_A, paymentId: id, invoiceId, amount } });
  }

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
    await this.prisma.itemPrice.deleteMany();
    await this.prisma.priceList.deleteMany();
    await this.prisma.codeSequence.deleteMany({ where: { prefix: { in: ['CLI', 'PED', 'DES', 'FAC'] } } });

    for (const [id, slug] of [
      [TENANT_A, 'contract-sales-a'],
      [TENANT_B, 'contract-sales-b'],
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

    // Una lista para poder guardar un pedido cotizado con ella.
    await this.prisma.priceList.upsert({
      where: { id: RETAIL_LIST },
      create: { id: RETAIL_LIST, tenantId: TENANT_A, code: 'LPR900001', name: 'Contrato detal', currency: 'USD', isDefault: true, updatedAt: new Date() },
      update: {},
    });

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
