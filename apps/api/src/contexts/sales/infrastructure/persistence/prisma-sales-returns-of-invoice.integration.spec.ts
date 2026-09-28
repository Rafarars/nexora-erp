import { ConfigService } from '@nestjs/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Env } from '../../../../shared/config/env.schema.js';
import { SystemClock } from '../../../../shared/infrastructure/system-clock.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PrismaReceivableBalances } from '../../../receivables/infrastructure/persistence/prisma-receivable-balances.js';
import { InvoiceCanceller } from '../../application/cancel-invoice/invoice-canceller.js';
import { InvoiceWithReturnsError } from '../../domain/errors/sales.errors.js';
import { InvoiceIssuance } from '../../domain/invoice/posting/invoice-issuance.js';
import { SalesOrderLineId } from '../../domain/order/sales-order-line.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PrismaSalesPortsHarness } from '../testing/prisma-sales-ports.harness.js';
import { PrismaInvoicePosting } from './prisma-invoice-posting.js';
import { PrismaSalesReturnsOfInvoice } from './prisma-sales-returns-of-invoice.js';

import { MAIN, PIECE, TENANT_A, WATER } from '../../domain/testing/sales.mother.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return url;
}

describe('PrismaSalesReturnsOfInvoice integration', () => {
  const harness = new PrismaSalesPortsHarness();
  const prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  const returnsOfInvoice = new PrismaSalesReturnsOfInvoice(prisma);
  const tenant = TenantId.of(TENANT_A);

  beforeEach(async () => {
    await harness.reset();
  });

  afterAll(async () => {
    await harness.close();
    await prisma.$disconnect();
  });

  it('restricts invoice cancellation if there are confirmed returns on its order lines (§3.6)', async () => {
    const customerId = '00000000-0000-4000-8000-000000000002';
    const warehouseId = MAIN;
    const itemId = WATER;
    const unitId = PIECE;
    const orderId = '00000000-0000-4000-8000-000000000010';
    const orderLineId = '00000000-0000-4000-8000-000000000011';
    const dispatchId = '00000000-0000-4000-8000-000000000020';
    const dispatchLineId = '00000000-0000-4000-8000-000000000021';
    const invoiceId = '00000000-0000-4000-8000-000000000030';
    const returnId = '00000000-0000-4000-8000-000000000040';

    await prisma.customer.create({
      data: {
        id: customerId,
        tenantId: tenant.value,
        code: 'CLI001',
        name: 'Cliente Prueba',
        paymentTermDays: 30,
        isActive: true,
      },
    });

    await prisma.salesOrder.create({
      data: {
        id: orderId,
        tenantId: tenant.value,
        code: 'PED001',
        customerId,
        warehouseId,
        orderDate: new Date('2026-01-10T00:00:00Z'),
        status: 'confirmed',
        currency: 'USD',
        baseCurrency: 'USD',
        exchangeRate: 1,
        baseExchangeRate: 1,
        lines: {
          create: {
            id: orderLineId,
            lineNumber: 1,
            itemId,
            itemSku: 'SKU01',
            itemName: 'Articulo 1',
            unitId,
            quantity: 10,
            baseQuantity: 10,
            unitPrice: 10,
            taxRate: 16,
            dispatchedQuantity: 10,
            invoicedQuantity: 10,
          },
        },
      },
    });

    await prisma.dispatch.create({
      data: {
        id: dispatchId,
        tenantId: tenant.value,
        code: 'DES001',
        orderId,
        warehouseId,
        dispatchDate: new Date('2026-01-11T00:00:00Z'),
        status: 'confirmed',
        lines: {
          create: {
            id: dispatchLineId,
            lineNumber: 1,
            orderLineId,
            itemId,
            itemSku: 'SKU01',
            itemName: 'Articulo 1',
            unitId,
            quantity: 10,
            baseQuantity: 10,
          },
        },
      },
    });

    await prisma.invoice.create({
      data: {
        id: invoiceId,
        tenantId: tenant.value,
        code: 'FAC001',
        orderId,
        dispatchId,
        customerId,
        issueDate: new Date('2026-01-12T00:00:00Z'),
        dueDate: new Date('2026-02-12T00:00:00Z'),
        status: 'issued',
        currency: 'USD',
        baseCurrency: 'USD',
        exchangeRate: 1,
        baseExchangeRate: 1,
        subtotal: 100,
        tax: 16,
        total: 116,
        lines: {
          create: {
            id: '00000000-0000-4000-8000-000000000031',
            lineNumber: 1,
            orderLineId,
            itemId,
            itemSku: 'SKU01',
            itemName: 'Articulo 1',
            unitId,
            quantity: 10,
            unitPrice: 10,
            taxRate: 16,
            subtotal: 100,
            tax: 16,
          },
        },
      },
    });

    // 1. Sin devoluciones, count es 0
    const countBefore = await returnsOfInvoice.countConfirmedReturnsOf(tenant, [SalesOrderLineId.of(orderLineId)]);
    expect(countBefore).toBe(0);

    // 2. Crear devolucion en borrador: no debe bloquear
    await prisma.salesReturn.create({
      data: {
        id: returnId,
        tenantId: tenant.value,
        code: 'DVV001',
        customerId,
        dispatchId,
        warehouseId,
        returnDate: new Date('2026-01-13T00:00:00Z'),
        condition: 'resalable',
        reason: 'Defecto',
        status: 'draft',
        currency: 'USD',
        baseCurrency: 'USD',
        lines: {
          create: {
            id: '00000000-0000-4000-8000-000000000041',
            lineNumber: 1,
            dispatchLineId,
            itemId,
            itemSku: 'SKU01',
            itemName: 'Articulo 1',
            unitId,
            quantity: 2,
            baseQuantity: 2,
            unitCost: 8,
          },
        },
      },
    });

    const countDraft = await returnsOfInvoice.countConfirmedReturnsOf(tenant, [SalesOrderLineId.of(orderLineId)]);
    expect(countDraft).toBe(0);

    // 3. Confirmar la devolucion: debe contar 1
    await prisma.salesReturn.update({
      where: { id: returnId },
      data: { status: 'confirmed' },
    });

    const countConfirmed = await returnsOfInvoice.countConfirmedReturnsOf(tenant, [SalesOrderLineId.of(orderLineId)]);
    expect(countConfirmed).toBe(1);

    // 4. Intentar anular la factura con InvoiceCanceller: debe rechazar con InvoiceWithReturnsError
    const canceller = new InvoiceCanceller(
      new PrismaInvoicePosting(prisma, new PrismaReceivableBalances()),
      new InvoiceIssuance(),
      returnsOfInvoice,
      new SystemClock(),
    );

    await expect(canceller.run({ tenantId: tenant.value, invoiceId })).rejects.toThrow(InvoiceWithReturnsError);

    // La factura sigue emitida
    const invoiceAfter = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoiceAfter.status).toBe('issued');

    // 5. Al anular la devolucion (documento anulado no bloquea): la factura se puede anular
    await prisma.salesReturn.update({
      where: { id: returnId },
      data: { status: 'cancelled' },
    });

    await expect(canceller.run({ tenantId: tenant.value, invoiceId })).resolves.toBeUndefined();

    const invoiceCancelled = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoiceCancelled.status).toBe('cancelled');
  });
});
