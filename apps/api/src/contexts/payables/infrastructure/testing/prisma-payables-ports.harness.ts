import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PayableInvoicePrimitives } from '../../domain/ledger/payable-invoice.js';
import { PayableSupplier } from '../../domain/ledger/payables-ledger.js';
import { PayablesPorts, PayablesPortsHarness } from '../../testing/payables-ports.harness.js';
import { PrismaPayablesCodeSequence } from '../persistence/prisma-payables-code-sequence.js';
import { PrismaPayablesLedger } from '../persistence/prisma-payables-ledger.js';
import { PrismaSupplierPaymentPosting } from '../persistence/prisma-supplier-payment-posting.js';
import { PrismaSupplierPaymentRepository } from '../persistence/prisma-supplier-payment.repository.js';
import { PrismaSupplierCreditNoteRepository } from '../persistence/prisma-supplier-credit-note.repository.js';
import { PrismaSupplierCreditNotePosting } from '../persistence/prisma-supplier-credit-note-posting.js';
import { ClockBusinessCalendar } from '../../../../shared/infrastructure/testing/clock-business-calendar.js';
import { SystemClock } from '../../../../shared/infrastructure/system-clock.js';
import { PrismaInvoiceRevaluationPosting } from '../../../inventory/infrastructure/persistence/prisma-invoice-revaluation-posting.js';
import { PrismaInventoryCodeSequence } from '../../../inventory/infrastructure/persistence/prisma-inventory-code-sequence.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');

  return url;
}

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export class PrismaPayablesPortsHarness implements PayablesPortsHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  private sequence = 0;

  ports(): PayablesPorts {
    const codes = new PrismaPayablesCodeSequence(this.prisma);
    const ids = { next: () => crypto.randomUUID() };
    const calendar = new ClockBusinessCalendar(new SystemClock());
    const revaluationPosting = new PrismaInvoiceRevaluationPosting(
      this.prisma,
      new PrismaInventoryCodeSequence(this.prisma),
    );

    return {
      payments: new PrismaSupplierPaymentRepository(this.prisma),
      posting: new PrismaSupplierPaymentPosting(this.prisma),
      ledger: new PrismaPayablesLedger(this.prisma),
      codes,
      creditNotes: new PrismaSupplierCreditNoteRepository(this.prisma),
      creditNotePosting: new PrismaSupplierCreditNotePosting(this.prisma, codes, ids, revaluationPosting, calendar),
    };
  }

  async supplier(tenantId: string, supplier: PayableSupplier): Promise<void> {
    await this.prisma.supplier.create({ data: { ...supplier, tenantId, updatedAt: new Date() } });
  }

  async invoice(tenantId: string, invoice: Omit<PayableInvoicePrimitives, 'paid'>): Promise<void> {
    const n = String((this.sequence += 1)).padStart(6, '0');
    const date = asDate(invoice.issueDate);

    await this.prisma.purchaseInvoice.create({
      data: {
        id: invoice.id,
        tenantId,
        code: invoice.code,
        supplierId: invoice.supplierId,
        supplierInvoiceNumber: `FAC-${n}`,
        supplierInvoiceSeries: null,
        issueDate: date,
        dueDate: asDate(invoice.dueDate),
        status: invoice.status,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        baseCurrency: invoice.baseCurrency,
        baseExchangeRate: invoice.baseExchangeRate,
        manualExchangeRate: invoice.manualExchangeRate,
        subtotal: invoice.total,
        tax: 0,
        total: invoice.total,
        subtotalVes: invoice.total * (invoice.exchangeRate ?? 1),
        taxVes: 0,
        totalVes: invoice.total * (invoice.exchangeRate ?? 1),
        priceDifference: 0,
        exchangeDifference: 0,
        updatedAt: date,
      },
    });
  }

  async cancelInvoice(tenantId: string, invoiceId: string): Promise<void> {
    await this.prisma.purchaseInvoice.update({
      where: { tenantId_id: { tenantId, id: invoiceId } },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
  }

  async purchaseReturn(
    tenantId: string,
    returnId: string,
    supplierId: string,
    status: 'confirmed' | 'draft' | 'cancelled' = 'confirmed',
    receiptLineIds?: string[],
  ): Promise<void> {
    let warehouseId: string;
    const existingWarehouse = await this.prisma.warehouse.findFirst({ where: { tenantId } });
    if (existingWarehouse) {
      warehouseId = existingWarehouse.id;
    } else {
      const createdWh = await this.prisma.warehouse.create({
        data: {
          tenantId,
          id: crypto.randomUUID(),
          code: `BOD${crypto.randomUUID().slice(0, 6)}`,
          name: 'Bodega Test',
        },
      });
      warehouseId = createdWh.id;
    }

    let receiptId: string;
    let currency = 'USD';
    let exchangeRate: number | null = 36.5;
    let baseCurrency = 'VES';
    let baseExchangeRate: number | null = 1;

    let receiptLinesToReturn: Array<{
      id: string;
      orderLineId: string;
      itemId: string;
      itemSku: string;
      itemName: string;
      unitId: string;
      quantity: number;
      unitCost: number;
    }> = [];

    if (receiptLineIds && receiptLineIds.length > 0) {
      const recLines = await this.prisma.goodsReceiptLine.findMany({
        where: { tenantId, id: { in: receiptLineIds } },
        include: { receipt: true },
      });
      if (recLines.length > 0) {
        receiptId = recLines[0].receiptId;
        currency = recLines[0].receipt.currency;
        exchangeRate = recLines[0].receipt.exchangeRate ? Number(recLines[0].receipt.exchangeRate) : null;
        baseCurrency = recLines[0].receipt.baseCurrency;
        baseExchangeRate = recLines[0].receipt.baseExchangeRate ? Number(recLines[0].receipt.baseExchangeRate) : null;
        if (recLines[0].receipt.warehouseId) {
          warehouseId = recLines[0].receipt.warehouseId;
        }

        receiptLinesToReturn = recLines.map((rl) => ({
          id: rl.id,
          orderLineId: rl.orderLineId,
          itemId: rl.itemId,
          itemSku: rl.itemSku,
          itemName: rl.itemName,
          unitId: rl.unitId,
          quantity: Number(rl.quantity),
          unitCost: Number(rl.unitCost),
        }));
      } else {
        receiptId = crypto.randomUUID();
      }
    } else {
      const existingReceipt = await this.prisma.goodsReceipt.findFirst({
        where: { tenantId, order: { supplierId } },
        include: { lines: true },
      });
      if (existingReceipt) {
        receiptId = existingReceipt.id;
        currency = existingReceipt.currency;
        exchangeRate = existingReceipt.exchangeRate ? Number(existingReceipt.exchangeRate) : null;
        baseCurrency = existingReceipt.baseCurrency;
        baseExchangeRate = existingReceipt.baseExchangeRate ? Number(existingReceipt.baseExchangeRate) : null;
        receiptLinesToReturn = existingReceipt.lines.map((rl) => ({
          id: rl.id,
          orderLineId: rl.orderLineId,
          itemId: rl.itemId,
          itemSku: rl.itemSku,
          itemName: rl.itemName,
          unitId: rl.unitId,
          quantity: Number(rl.quantity),
          unitCost: Number(rl.unitCost),
        }));
      } else {
        receiptId = crypto.randomUUID();
      }
    }

    const n = String((this.sequence += 1)).padStart(6, '0');
    await this.prisma.purchaseReturn.create({
      data: {
        id: returnId,
        tenantId,
        code: `DVC${n}`,
        supplierId,
        receiptId,
        warehouseId,
        returnDate: new Date('2026-01-03'),
        status,
        currency,
        exchangeRate,
        baseCurrency,
        baseExchangeRate,
        confirmedAt: status === 'confirmed' ? new Date('2026-01-03') : null,
        cancelledAt: status === 'cancelled' ? new Date('2026-01-03') : null,
      },
    });

    for (let i = 0; i < receiptLinesToReturn.length; i++) {
      const rl = receiptLinesToReturn[i];
      await this.prisma.purchaseReturnLine.create({
        data: {
          id: crypto.randomUUID(),
          tenantId,
          purchaseReturnId: returnId,
          receiptLineId: rl.id,
          lineNumber: i + 1,
          itemId: rl.itemId,
          itemSku: rl.itemSku,
          itemName: rl.itemName,
          unitId: rl.unitId,
          quantity: rl.quantity,
          baseQuantity: rl.quantity,
          unitCost: rl.unitCost,
        },
      });
    }
  }

  async invoiceLines(
    tenantId: string,
    invoiceId: string,
    lines: Array<{
      id: string;
      itemId?: string | null;
      itemSku?: string | null;
      itemName?: string | null;
      unitId?: string | null;
      quantity?: number;
      unitPrice?: number;
      subtotal: number;
      receiptLineId?: string | null;
      warehouseId?: string;
      receiptRate?: number;
      sourceMovementId?: string;
    }>,
  ): Promise<void> {
    const inv = await this.prisma.purchaseInvoice.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id: invoiceId } },
      select: { supplierId: true, currency: true, exchangeRate: true, baseCurrency: true, baseExchangeRate: true },
    });

    let warehouse = await this.prisma.warehouse.findFirst({ where: { tenantId } });
    if (!warehouse) {
      warehouse = await this.prisma.warehouse.create({
        data: {
          tenantId,
          id: crypto.randomUUID(),
          code: `BOD${crypto.randomUUID().slice(0, 6)}`,
          name: 'Bodega Test',
        },
      });
    }

    let unit = await this.prisma.measurementUnit.findFirst({ where: { tenantId } });
    if (!unit) {
      unit = await this.prisma.measurementUnit.create({
        data: {
          tenantId,
          id: crypto.randomUUID(),
          code: `UOM${crypto.randomUUID().slice(0, 6)}`,
          name: 'Unidad Test',
          abbreviation: 'und',
        },
      });
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let receiptLineId = line.receiptLineId;

      if (line.itemId && !receiptLineId) {
        let item = await this.prisma.item.findUnique({
          where: { tenantId_id: { tenantId, id: line.itemId } },
        });
        if (!item) {
          item = await this.prisma.item.create({
            data: {
              tenantId,
              id: line.itemId,
              code: `ART${crypto.randomUUID().slice(0, 6)}`,
              sku: line.itemSku ?? `SKU-${crypto.randomUUID().slice(0, 6)}`,
              name: line.itemName ?? 'Articulo Test',
              type: 'inventoried',
            },
          });
          await this.prisma.itemUnit.create({
            data: { tenantId, itemId: line.itemId, unitId: unit.id, conversionFactor: 1, isBase: true },
          });
        }

        const warehouseId = line.warehouseId ?? warehouse.id;
        const unitId = line.unitId ?? unit.id;
        const orderId = crypto.randomUUID();
        await this.prisma.purchaseOrder.create({
          data: {
            id: orderId,
            tenantId,
            code: `OC${crypto.randomUUID().slice(0, 8)}`,
            supplierId: inv.supplierId,
            warehouseId,
            orderDate: new Date('2026-01-01'),
            status: 'confirmed',
            currency: inv.currency,
            baseCurrency: inv.baseCurrency,
            updatedAt: new Date('2026-01-01'),
          },
        });

        const orderLineId = crypto.randomUUID();
        await this.prisma.purchaseOrderLine.create({
          data: {
            id: orderLineId,
            tenantId,
            orderId,
            lineNumber: 1,
            itemId: line.itemId,
            itemSku: line.itemSku ?? item.sku,
            itemName: line.itemName ?? item.name,
            unitId,
            quantity: line.quantity ?? 1,
            baseQuantity: line.quantity ?? 1,
            unitCost: line.unitPrice ?? line.subtotal,
          },
        });

        const receiptId = crypto.randomUUID();
        const receiptRate = line.receiptRate ?? (inv.exchangeRate ? Number(inv.exchangeRate) : 1);
        const receiptBaseCurrency = line.receiptRate ? 'VES' : inv.baseCurrency;
        const receiptBaseExchangeRate = line.receiptRate ? 1 : (inv.baseExchangeRate ? Number(inv.baseExchangeRate) : 1);
        await this.prisma.goodsReceipt.create({
          data: {
            id: receiptId,
            tenantId,
            code: `RC${crypto.randomUUID().slice(0, 8)}`,
            orderId,
            warehouseId,
            receiptDate: new Date('2026-01-02'),
            status: 'confirmed',
            currency: inv.currency,
            exchangeRate: receiptRate,
            baseCurrency: receiptBaseCurrency,
            baseExchangeRate: receiptBaseExchangeRate,
            updatedAt: new Date('2026-01-02'),
          },
        });

        const recLineId = crypto.randomUUID();
        await this.prisma.goodsReceiptLine.create({
          data: {
            id: recLineId,
            tenantId,
            receiptId,
            lineNumber: 1,
            orderLineId,
            itemId: line.itemId,
            itemSku: line.itemSku ?? item.sku,
            itemName: line.itemName ?? item.name,
            unitId,
            quantity: line.quantity ?? 1,
            baseQuantity: line.quantity ?? 1,
            unitCost: line.unitPrice ?? line.subtotal,
          },
        });

        const lastMov = await this.prisma.inventoryMovement.findFirst({
          where: { tenantId, itemId: line.itemId, warehouseId },
          orderBy: { sequence: 'desc' },
          select: { sequence: true, balanceQuantity: true },
        });
        const seq = (lastMov?.sequence ?? 0) + 1;
        const qty = line.quantity ?? 1;
        const cost = line.unitPrice ?? line.subtotal;

        const movId = line.sourceMovementId ?? crypto.randomUUID();
        await this.prisma.inventoryMovement.create({
          data: {
            id: movId,
            tenantId,
            itemId: line.itemId,
            warehouseId,
            sequence: seq,
            direction: 'in',
            quantity: qty,
            unitCost: cost,
            balanceQuantity: Number(lastMov?.balanceQuantity ?? 0) + qty,
            balanceAverageCost: cost,
            originType: 'receipt',
            originId: receiptId,
            originLineId: recLineId,
            originDate: new Date('2026-01-02'),
            occurredAt: new Date('2026-01-02T10:00:00.000Z'),
          },
        });

        receiptLineId = recLineId;
      }

      await this.prisma.purchaseInvoiceLine.create({
        data: {
          id: line.id,
          tenantId,
          invoiceId,
          lineNumber: i + 1,
          itemId: line.itemId ?? null,
          itemSku: line.itemSku ?? null,
          itemName: line.itemName ?? 'Linea factura',
          concept: 'Linea factura',
          unitId: line.unitId ?? null,
          quantity: line.quantity ?? 1,
          unitPrice: line.unitPrice ?? line.subtotal,
          subtotal: line.subtotal,
          taxRate: 0,
          tax: 0,
          total: line.subtotal,
          receiptLineId: receiptLineId ?? null,
        },
      });
    }
  }

  async adjustmentsOf(
    tenantId: string,
    originId: string,
  ): Promise<Array<{
    id: string;
    code: string;
    status: string;
    type: string;
    originType: string;
    originId: string;
    lines: Array<{ itemId: string; amount: number; direction: string; sourceMovementId?: string }>;
  }>> {
    const rows = await this.prisma.adjustment.findMany({
      where: { tenantId, originId },
      include: { lines: true },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      type: r.type,
      originType: r.originType ?? '',
      originId: r.originId ?? '',
      lines: r.lines.map((l) => ({
        itemId: l.itemId,
        amount: Number(l.amount),
        direction: l.direction,
        sourceMovementId: l.sourceMovementId ?? undefined,
      })),
    }));
  }

  async approveAdjustment(tenantId: string, adjustmentId: string): Promise<void> {
    await this.prisma.adjustment.update({
      where: { tenantId_id: { tenantId, id: adjustmentId } },
      data: { status: 'confirmed' },
    });
  }

  async ensureItem(tenantId: string, itemId: string): Promise<void> {
    const existing = await this.prisma.item.findUnique({
      where: { tenantId_id: { tenantId, id: itemId } },
    });
    if (!existing) {
      let unit = await this.prisma.measurementUnit.findFirst({ where: { tenantId } });
      if (!unit) {
        unit = await this.prisma.measurementUnit.create({
          data: {
            tenantId,
            id: crypto.randomUUID(),
            code: `UNI${crypto.randomUUID().slice(0, 6)}`,
            name: 'Unidad Test',
            abbreviation: 'u',
          },
        });
      }
      await this.prisma.item.create({
        data: {
          tenantId,
          id: itemId,
          code: `ART${crypto.randomUUID().slice(0, 6)}`,
          sku: `SKU-${crypto.randomUUID().slice(0, 6)}`,
          name: 'Articulo Test B',
          type: 'inventoried',
        },
      });
      await this.prisma.itemUnit.create({
        data: { tenantId, itemId, unitId: unit.id, conversionFactor: 1, isBase: true },
      });
    }
  }

  async setAmountDecimals(_tenantId: string, _decimals: number): Promise<void> {}

  async reset(): Promise<void> {
    await this.prisma.paymentAllocation.deleteMany();
    await this.prisma.supplierPaymentAllocation.deleteMany();
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
    await this.prisma.goodsReceiptLine.deleteMany();
    await this.prisma.goodsReceipt.deleteMany();
    await this.prisma.purchaseOrderLine.deleteMany();
    await this.prisma.purchaseOrder.deleteMany();
    await this.prisma.supplier.deleteMany();
    await this.prisma.adjustmentLine.deleteMany();
    await this.prisma.adjustment.deleteMany();
    await this.prisma.inventoryMovement.updateMany({ data: { reversalOfId: null, restoresMovementId: null } });
    await this.prisma.inventoryMovement.deleteMany();
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
