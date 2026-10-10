import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
// El arnes compone el sistema de verdad como lo hace el modulo: compras con el inventario real
// detras de DOCUMENT_STOCK_POSTING. Es composicion de prueba, no dependencia del dominio.
import { PrismaDocumentStockPosting } from '../../../inventory/infrastructure/persistence/prisma-document-stock-posting.js';
import { BOX, MAIN, NORTH, PIECE, SERVICE, TENANT_A, TENANT_B, WATER } from '../../domain/testing/purchasing.mother.js';
import { PurchasingPorts, PurchasingPortsHarness } from '../../testing/purchasing-ports.harness.js';
import { PrismaGoodsReceiptRepository } from '../persistence/prisma-goods-receipt.repository.js';
import { PrismaInvoiceRevaluationPosting } from '../../../inventory/infrastructure/persistence/prisma-invoice-revaluation-posting.js';
import { PrismaInventoryCodeSequence } from '../../../inventory/infrastructure/persistence/prisma-inventory-code-sequence.js';
import { PrismaPurchaseInvoicePosting } from '../persistence/prisma-purchase-invoice-posting.js';
import { PrismaPurchaseInvoiceRepository } from '../persistence/prisma-purchase-invoice.repository.js';
import { PrismaPurchaseOrderPosting } from '../persistence/prisma-purchase-order-posting.js';
import { PrismaPurchaseOrderRepository } from '../persistence/prisma-purchase-order.repository.js';
import { PrismaPurchaseReturnPosting } from '../persistence/prisma-purchase-return-posting.js';
import { PrismaPurchaseReturnRepository } from '../persistence/prisma-purchase-return.repository.js';
import { PrismaPurchasingCodeSequence } from '../persistence/prisma-purchasing-code-sequence.js';
import { PrismaReceiptPosting } from '../persistence/prisma-receipt-posting.js';
import { PrismaSupplierRepository } from '../persistence/prisma-supplier.repository.js';
import { ClockBusinessCalendar } from '../../../../shared/infrastructure/testing/clock-business-calendar.js';
import { SystemClock } from '../../../../shared/infrastructure/system-clock.js';
import { PrismaDocumentAccountingPosting } from '../../../accounting/infrastructure/persistence/prisma-document-accounting-posting.js';
import { seedAccountingForTenant } from '../../../accounting/infrastructure/testing/accounting-seed.helper.js';

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
    const stockPosting = new PrismaDocumentStockPosting({ next: () => `9${ids.next().slice(1)}` });
    const revaluationPosting = new PrismaInvoiceRevaluationPosting(
      this.prisma,
      new PrismaInventoryCodeSequence(this.prisma),
    );

    const calendar = new ClockBusinessCalendar(new SystemClock());
    const accounting = new PrismaDocumentAccountingPosting();

    return {
      suppliers: new PrismaSupplierRepository(this.prisma),
      orders: new PrismaPurchaseOrderRepository(this.prisma),
      receipts: new PrismaGoodsReceiptRepository(this.prisma),
      returns: new PrismaPurchaseReturnRepository(this.prisma),
      invoices: new PrismaPurchaseInvoiceRepository(this.prisma),
      orderPosting: new PrismaPurchaseOrderPosting(this.prisma),
      receiptPosting: new PrismaReceiptPosting(this.prisma, stockPosting, accounting),
      returnPosting: new PrismaPurchaseReturnPosting(this.prisma, stockPosting, accounting),
      invoicePosting: new PrismaPurchaseInvoicePosting(this.prisma, revaluationPosting, calendar, accounting),
      revaluations: revaluationPosting,
      codes: new PrismaPurchasingCodeSequence(this.prisma),
    };
  }

  async adjustmentsOf(tenantId: string, invoiceId: string): Promise<Array<{ id: string; code: string; status: string; type: string; lines: Array<{ itemId: string; amount: number; direction: string }> }>> {
    const rows = await this.prisma.adjustment.findMany({
      where: { tenantId, originType: 'purchase_invoice', originId: invoiceId },
      include: { lines: true },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      type: r.type,
      lines: r.lines.map((l) => ({ itemId: l.itemId, amount: Number(l.amount), direction: l.direction })),
    }));
  }

  async stockOf(itemId: string, warehouseId: string): Promise<number> {
    const row = await this.prisma.itemStock.findFirst({ where: { tenantId: TENANT_A, itemId, warehouseId } });

    return row ? row.quantity.toNumber() : 0;
  }

  async averageCostOf(itemId: string, warehouseId: string): Promise<number> {
    const row = await this.prisma.itemStock.findFirst({ where: { tenantId: TENANT_A, itemId, warehouseId } });

    return row ? row.averageCost.toNumber() : 0;
  }

  // Resta la existencia sin kardex: solo para provocar que revertir no alcance.
  async withdraw(itemId: string, warehouseId: string, quantity: number): Promise<void> {
    await this.prisma.itemStock.updateMany({ where: { tenantId: TENANT_A, itemId, warehouseId }, data: { quantity: { decrement: quantity } } });
  }

  async attachConfirmedCreditNote(invoiceId: string, amount: number): Promise<void> {
    const inv = await this.prisma.purchaseInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    await this.prisma.supplierCreditNote.create({
      data: {
        id: `0c000000-0000-4000-8000-${Math.random().toString().slice(2, 14)}`,
        tenantId: inv.tenantId,
        code: `NCP${Math.floor(Math.random() * 899999 + 100000)}`,
        supplierId: inv.supplierId,
        invoiceId: inv.id,
        issueDate: inv.issueDate,
        reason: 'subsequent_discount',
        status: 'confirmed',
        currency: inv.currency,
        exchangeRate: inv.exchangeRate,
        baseCurrency: inv.baseCurrency,
        baseExchangeRate: inv.baseExchangeRate,
        subtotal: amount,
        tax: 0,
        total: amount,
        notes: 'NCP en contrato',
      },
    });
  }

  async reset(): Promise<void> {
    await this.prisma.journalEntryLine.deleteMany();
    await this.prisma.journalEntry.deleteMany();
    await this.prisma.supplierPaymentAllocation.deleteMany();
    await this.prisma.paymentAllocation.deleteMany();
    await this.prisma.supplierCreditNote.updateMany({ data: { issuePaymentId: null } });
    await this.prisma.customerCreditNote.updateMany({ data: { issuePaymentId: null } });
    await this.prisma.supplierPayment.updateMany({ data: { creditSourceId: null } });
    await this.prisma.customerPayment.updateMany({ data: { creditSourceId: null } });
    await this.prisma.supplierCreditNoteLine.deleteMany();
    await this.prisma.supplierCreditNote.deleteMany();
    await this.prisma.customerCreditNoteLine.deleteMany();
    await this.prisma.customerCreditNote.deleteMany();
    await this.prisma.supplierPayment.deleteMany();
    await this.prisma.customerPayment.deleteMany();
    await this.prisma.salesReturnLine.deleteMany();
    await this.prisma.salesReturn.deleteMany();
    await this.prisma.purchaseReturnLine.deleteMany();
    await this.prisma.purchaseReturn.deleteMany();
    await this.prisma.purchaseInvoiceLine.deleteMany();
    await this.prisma.purchaseInvoice.deleteMany();
    await this.prisma.invoiceLine.deleteMany();
    await this.prisma.invoice.deleteMany();
    await this.prisma.dispatchLine.deleteMany();
    await this.prisma.dispatch.deleteMany();
    await this.prisma.salesOrderLine.deleteMany();
    await this.prisma.salesOrder.deleteMany();
    await this.prisma.customer.deleteMany();
    await this.prisma.goodsReceiptLine.deleteMany();
    await this.prisma.goodsReceipt.deleteMany();
    await this.prisma.purchaseOrderLine.deleteMany();
    await this.prisma.purchaseOrder.deleteMany();
    await this.prisma.supplier.deleteMany();
    await this.prisma.adjustmentLine.deleteMany();
    await this.prisma.adjustment.deleteMany();
    await this.prisma.inventoryMovement.updateMany({ data: { reversalOfId: null, restoresMovementId: null } });
    await this.prisma.inventoryMovement.deleteMany();
    await this.prisma.itemStock.deleteMany();
    await this.prisma.codeSequence.deleteMany({ where: { prefix: { in: ['PRV', 'OC', 'ENT', 'DVC', 'FCP'] } } });

    for (const [id, slug] of [
      [TENANT_A, 'contract-purchasing-a'],
      [TENANT_B, 'contract-purchasing-b'],
    ]) {
      await this.prisma.tenant.upsert({ where: { id }, create: { id, name: slug, slug }, update: {} });
      await seedAccountingForTenant(this.prisma, id);
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

    await this.prisma.item.upsert({
      where: { id: SERVICE },
      create: { id: SERVICE, tenantId: TENANT_A, code: 'SRV900001', sku: 'CONTRATO-SERVICIO', name: 'Contrato servicio', type: 'service' },
      update: {},
    });

    await this.prisma.itemUnit.upsert({
      where: { itemId_unitId: { itemId: SERVICE, unitId: PIECE } },
      create: { tenantId: TENANT_A, itemId: SERVICE, unitId: PIECE, conversionFactor: 1, isBase: true },
      update: {},
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
