import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ReportCustomer, ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { ReportingReadModelHarness, SeedInvoice, SeedPayment, SeedReceipt } from '../../testing/reporting-read-model.harness.js';
import { PrismaReportingReadModel } from '../persistence/prisma-reporting-read-model.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');

  return url;
}

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const uuid = () => crypto.randomUUID();

// Escribe las filas como las dejan los demas modulos, con los pedidos, despachos, ordenes y
// proveedores minimos que piden sus claves ajenas. El catalogo lo comparten otros arneses con los
// mismos identificadores: se crea si falta y nunca se modifica.
export class PrismaReportingReadModelHarness implements ReportingReadModelHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  private counter = 0;

  readModel(): ReportingReadModel {
    return new PrismaReportingReadModel(this.prisma);
  }

  async company(tenantId: string, name: string, profile?: { legalName: string; fiscalId: string | null }): Promise<void> {
    await this.prisma.tenant.upsert({ where: { id: tenantId }, create: { id: tenantId, name, slug: `contract-reporting-${tenantId.slice(0, 4)}` }, update: { name } });
    await this.prisma.companyProfile.deleteMany({ where: { tenantId } });

    if (profile) await this.prisma.companyProfile.create({ data: { tenantId, ...profile, updatedAt: new Date() } });
  }

  async customer(tenantId: string, customer: ReportCustomer): Promise<void> {
    await this.prisma.customer.create({ data: { ...customer, tenantId, updatedAt: new Date() } });
  }

  async warehouse(tenantId: string, warehouse: { id: string; name: string }): Promise<void> {
    await this.prisma.warehouse.upsert({ where: { id: warehouse.id }, create: { ...warehouse, tenantId, code: this.code('BOD') }, update: {} });
  }

  async item(tenantId: string, item: { id: string; sku: string; name: string; baseUnit: string }): Promise<void> {
    const unit =
      (await this.prisma.measurementUnit.findFirst({ where: { tenantId, abbreviation: item.baseUnit } })) ??
      (await this.prisma.measurementUnit.create({ data: { id: uuid(), tenantId, code: this.code('UOM'), name: `Contrato ${item.baseUnit}`, abbreviation: item.baseUnit } }));

    await this.prisma.item.upsert({ where: { id: item.id }, create: { id: item.id, tenantId, code: this.code('ART'), sku: item.sku, name: item.name, type: 'inventoried' }, update: {} });
    await this.prisma.itemUnit.upsert({
      where: { itemId_unitId: { itemId: item.id, unitId: unit.id } },
      create: { tenantId, itemId: item.id, unitId: unit.id, conversionFactor: 1, isBase: true },
      update: {},
    });
  }

  async invoice(tenantId: string, invoice: SeedInvoice): Promise<void> {
    const warehouseId = (await this.prisma.warehouse.findFirstOrThrow({ where: { tenantId } })).id;
    const orderId = uuid();
    const dispatchId = uuid();
    const date = asDate(invoice.issueDate);

    await this.prisma.salesOrder.create({ data: { id: orderId, tenantId, code: this.code('PED'), customerId: invoice.customerId, warehouseId, orderDate: date, status: 'dispatched', currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false, subtotalVes: 0, taxVes: 0, totalVes: 0, updatedAt: date } });
    await this.prisma.dispatch.create({ data: { id: dispatchId, tenantId, code: this.code('DES'), orderId, warehouseId, dispatchDate: date, status: 'confirmed', currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false, amountVes: 0, updatedAt: date } });
    await this.prisma.invoice.create({
      data: {
        id: invoice.id,
        tenantId,
        code: invoice.code,
        dispatchId,
        orderId,
        customerId: invoice.customerId,
        issueDate: date,
        dueDate: asDate(invoice.dueDate),
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total, currency: 'USD', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 1, manualExchangeRate: false, subtotalVes: 0, taxVes: 0, totalVes: 0,
        updatedAt: date,
      },
    });

    for (const [index, line] of invoice.lines.entries()) {
      await this.prisma.invoiceLine.create({
        data: { id: uuid(), tenantId, invoiceId: invoice.id, lineNumber: index + 1, itemId: line.itemId, unitId: await this.baseUnit(line.itemId), quantity: 1, unitPrice: line.subtotal, taxRate: 0, subtotal: line.subtotal, tax: 0 },
      });
    }
  }

  async payment(tenantId: string, payment: SeedPayment): Promise<void> {
    const id = uuid();
    const amount = payment.allocations.reduce((sum, allocation) => sum + Math.round(allocation.amount * 100), 0) / 100;

    await this.prisma.customerPayment.create({
      data: { id, tenantId, code: payment.code, customerId: payment.customerId, paymentDate: asDate(payment.date), method: 'cash', currency: "USD", exchangeRate: 1, baseCurrency: "USD", baseExchangeRate: 1, manualExchangeRate: false, amount, status: payment.status, updatedAt: new Date() },
    });

    for (const allocation of payment.allocations) {
      await this.prisma.paymentAllocation.create({ data: { id: uuid(), tenantId, paymentId: id, invoiceId: allocation.invoiceId, amount: allocation.amount } });
    }
  }

  async receipt(tenantId: string, receipt: SeedReceipt): Promise<void> {
    const supplierId = uuid();
    const orderId = uuid();
    const receiptId = uuid();
    const date = asDate(receipt.date);

    await this.prisma.supplier.create({ data: { id: supplierId, tenantId, code: this.code('PRV'), name: `Contrato proveedor ${this.counter}`, updatedAt: date } });
    await this.prisma.purchaseOrder.create({ data: { id: orderId, tenantId, code: this.code('OC'), supplierId, warehouseId: receipt.warehouseId, orderDate: date, status: 'received', currency: 'USD', baseCurrency: 'USD', updatedAt: date } });
    await this.prisma.goodsReceipt.create({ data: { id: receiptId, tenantId, code: this.code('ENT'), orderId, warehouseId: receipt.warehouseId, receiptDate: date, status: receipt.status, currency: 'USD', baseCurrency: 'USD', updatedAt: date } });

    for (const [index, line] of receipt.lines.entries()) {
      const orderLineId = uuid();
      const unitId = await this.baseUnit(line.itemId);

      await this.prisma.purchaseOrderLine.create({
        data: { id: orderLineId, tenantId, orderId, lineNumber: index + 1, itemId: line.itemId, unitId, quantity: line.quantity, baseQuantity: line.quantity, unitCost: line.unitCost },
      });
      await this.prisma.goodsReceiptLine.create({
        data: { id: uuid(), tenantId, receiptId, lineNumber: index + 1, orderLineId, itemId: line.itemId, unitId, quantity: line.quantity, baseQuantity: line.quantity, unitCost: line.unitCost },
      });
    }
  }

  async stock(tenantId: string, stock: { itemId: string; warehouseId: string; quantity: number; averageCost: number }): Promise<void> {
    await this.prisma.itemStock.create({ data: { ...stock, tenantId, lastSequence: 0, updatedAt: new Date() } });
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
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private code(prefix: string): string {
    return `${prefix}${String((this.counter += 1) + 920000).padStart(12 - prefix.length, '0')}`;
  }

  private async baseUnit(itemId: string): Promise<string> {
    return (await this.prisma.itemUnit.findFirstOrThrow({ where: { itemId, isBase: true } })).unitId;
  }
}
