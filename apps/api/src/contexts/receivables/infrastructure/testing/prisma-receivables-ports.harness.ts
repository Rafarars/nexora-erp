import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ReceivableInvoicePrimitives } from '../../domain/ledger/receivable-invoice.js';
import { ReceivableCustomer } from '../../domain/ledger/receivables-ledger.js';
import { TENANT_A, TENANT_B } from '../../domain/testing/receivables.mother.js';
import { ReceivablesPorts, ReceivablesPortsHarness } from '../../testing/receivables-ports.harness.js';
import { PrismaPaymentPosting } from '../persistence/prisma-payment-posting.js';
import { PrismaPaymentRepository } from '../persistence/prisma-payment.repository.js';
import { PrismaReceivablesCodeSequence } from '../persistence/prisma-receivables-code-sequence.js';
import { PrismaReceivablesLedger } from '../persistence/prisma-receivables-ledger.js';

const WAREHOUSE: Record<string, string> = { [TENANT_A]: 'b7111111-1111-4111-8111-111111111111', [TENANT_B]: 'b7222222-2222-4222-8222-222222222222' };

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) throw new Error('DATABASE_URL is required to run the contract against PostgreSQL.');

  return url;
}

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

// Una factura en la base necesita su pedido y su despacho: se siembran los minimos, que en el
// sistema escribe ventas.
export class PrismaReceivablesPortsHarness implements ReceivablesPortsHarness {
  private readonly prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  private sequence = 0;

  ports(): ReceivablesPorts {
    return {
      payments: new PrismaPaymentRepository(this.prisma),
      posting: new PrismaPaymentPosting(this.prisma),
      ledger: new PrismaReceivablesLedger(this.prisma),
      codes: new PrismaReceivablesCodeSequence(this.prisma),
    };
  }

  async customer(tenantId: string, customer: ReceivableCustomer): Promise<void> {
    await this.prisma.customer.create({ data: { ...customer, tenantId, updatedAt: new Date() } });
  }

  async invoice(tenantId: string, invoice: Omit<ReceivableInvoicePrimitives, 'paid'>): Promise<void> {
    const n = String((this.sequence += 1)).padStart(6, '0');
    const orderId = `57000000-0000-4000-8000-${n.padStart(12, '0')}`;
    const dispatchId = `5d700000-0000-4000-8000-${n.padStart(12, '0')}`;
    const warehouseId = WAREHOUSE[tenantId];
    const date = asDate(invoice.issueDate);

    await this.prisma.salesOrder.create({ data: { id: orderId, tenantId, code: `PED7${n.slice(-5)}`, customerId: invoice.customerId, warehouseId, orderDate: date, status: 'dispatched', updatedAt: date } });
    await this.prisma.dispatch.create({ data: { id: dispatchId, tenantId, code: `DES7${n.slice(-5)}`, orderId, warehouseId, dispatchDate: date, status: 'confirmed', updatedAt: date } });
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
        subtotal: invoice.total,
        tax: 0,
        total: invoice.total,
        updatedAt: date,
      },
    });
  }

  async cancelInvoice(tenantId: string, invoiceId: string): Promise<void> {
    await this.prisma.invoice.update({ where: { tenantId_id: { tenantId, id: invoiceId } }, data: { status: 'cancelled', cancelledAt: new Date() } });
  }

  async reset(): Promise<void> {
    await this.prisma.customerPayment.deleteMany();
    await this.prisma.invoice.deleteMany();
    await this.prisma.dispatch.deleteMany();
    await this.prisma.salesOrder.deleteMany();
    await this.prisma.customer.deleteMany();
    await this.prisma.codeSequence.deleteMany({ where: { prefix: 'COB' } });

    for (const [id, slug] of [
      [TENANT_A, 'contract-receivables-a'],
      [TENANT_B, 'contract-receivables-b'],
    ]) {
      await this.prisma.tenant.upsert({ where: { id }, create: { id, name: slug, slug }, update: {} });
      await this.prisma.warehouse.upsert({ where: { id: WAREHOUSE[id] }, create: { id: WAREHOUSE[id], tenantId: id, code: 'BOD970001', name: 'Contrato cobranza' }, update: {} });
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
