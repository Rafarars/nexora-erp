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

  async setAmountDecimals(_tenantId: string, _decimals: number): Promise<void> {}

  async reset(): Promise<void> {
    await this.prisma.supplierPaymentAllocation.deleteMany();
    await this.prisma.supplierCreditNote.updateMany({ data: { issuePaymentId: null } });
    await this.prisma.supplierPayment.updateMany({ data: { creditSourceId: null } });
    await this.prisma.supplierCreditNoteLine.deleteMany();
    await this.prisma.supplierCreditNote.deleteMany();
    await this.prisma.supplierPayment.deleteMany();
    await this.prisma.purchaseInvoiceLine.deleteMany();
    await this.prisma.purchaseInvoice.deleteMany();
    await this.prisma.purchaseReturnLine.deleteMany();
    await this.prisma.purchaseReturn.deleteMany();
    await this.prisma.goodsReceiptLine.deleteMany();
    await this.prisma.goodsReceipt.deleteMany();
    await this.prisma.purchaseOrderLine.deleteMany();
    await this.prisma.purchaseOrder.deleteMany();
    await this.prisma.supplier.deleteMany();
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
