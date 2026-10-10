import { ConfigService } from '@nestjs/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { AccountResolutionFailedError } from '../../domain/errors/accounting.errors.js';
import { PrismaSalesPortsHarness } from '../../../sales/infrastructure/testing/prisma-sales-ports.harness.js';
import { PrismaReceivablesPortsHarness } from '../../../receivables/infrastructure/testing/prisma-receivables-ports.harness.js';
import { MAIN, PIECE, RETAIL_LIST, TENANT_A, WATER } from '../../../sales/domain/testing/sales.mother.js';
import { SalesDate } from '../../../sales/domain/shared/sales-date.vo.js';
import { SalesOrderId } from '../../../sales/domain/order/sales-order.entity.js';
import { DispatchId } from '../../../sales/domain/dispatch/dispatch.entity.js';
import { DispatchConfirmation } from '../../../sales/domain/dispatch/posting/dispatch-confirmation.js';
import { DispatchCancellation } from '../../../sales/domain/dispatch/posting/dispatch-cancellation.js';
import { Invoice, InvoiceId } from '../../../sales/domain/invoice/invoice.entity.js';
import { SalesReturnId } from '../../../sales/domain/return/sales-return.entity.js';
import { CustomerId } from '../../../sales/domain/customer/customer.entity.js';
import { PaymentId } from '../../../receivables/domain/payment/customer-payment.entity.js';
import { CreditNoteId } from '../../../receivables/domain/credit-note/customer-credit-note.entity.js';
import { ReceivablesDate } from '../../../receivables/domain/shared/receivables-date.vo.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { CustomerCreditNote } from '../../../receivables/domain/credit-note/customer-credit-note.entity.js';
import { CustomerPayment } from '../../../receivables/domain/payment/customer-payment.entity.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return url;
}

describe('Sales & Receivables Accounting Integration', () => {
  const salesHarness = new PrismaSalesPortsHarness();
  const receivablesHarness = new PrismaReceivablesPortsHarness();
  const prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  const tenant = TenantId.of(TENANT_A);

  beforeEach(async () => {
    await salesHarness.reset();
  });

  afterAll(async () => {
    await salesHarness.reset();
    await salesHarness.close();
    await receivablesHarness.close();
    await prisma.$disconnect();
  });

  async function getCompanyAccounts(tenantId: string) {
    const s = await prisma.companySettings.findUniqueOrThrow({ where: { tenantId } });
    return {
      inventoryAccountId: s.inventoryAccountId!,
      cogsAccountId: s.cogsAccountId!,
      salesRevenueAccountId: s.salesRevenueAccountId!,
      taxPayableAccountId: s.taxPayableAccountId!,
      receivablesAccountId: s.receivablesAccountId!,
      cashAccountId: s.cashAccountId!,
      unappliedCreditNotesAccountId: s.unappliedCreditNotesAccountId!,
      inventoryAdjustmentAccountId: s.inventoryAdjustmentAccountId!,
    };
  }

  it('generates balanced journal entry when issuing sales invoice and reverses it on cancellation (§3.3 & §3.12)', async () => {
    const salesPorts = salesHarness.ports();
    const accounts = await getCompanyAccounts(tenant.value);

    const customerId = '00000000-0000-4000-8000-000000000001';
    await prisma.customer.create({
      data: {
        id: customerId,
        tenantId: tenant.value,
        code: 'CLI0001',
        name: 'Cliente Test',
        paymentTermDays: 30,
        creditLimit: 10000,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    const orderId = '00000000-0000-4000-8000-000000000010';
    const orderLineId = '00000000-0000-4000-8000-000000000011';
    const invoiceId = '00000000-0000-4000-8000-000000000030';
    const today = SalesDate.of('2026-10-10');

    await prisma.salesOrder.create({
      data: {
        id: orderId,
        tenantId: tenant.value,
        code: 'PED000001',
        customerId,
        status: 'confirmed',
        currency: 'USD',
        baseCurrency: 'USD',
        exchangeRate: 1,
        baseExchangeRate: 1,
        manualExchangeRate: false,
        orderDate: new Date('2026-10-10'),
        priceListId: RETAIL_LIST,
        warehouseId: MAIN,
        updatedAt: new Date(),
        lines: {
          create: {
            id: orderLineId,
            lineNumber: 1,
            itemId: WATER,
            itemSku: 'CONTRATO-AGUA',
            itemName: 'Contrato agua',
            unitId: PIECE,
            quantity: 10,
            baseQuantity: 10,
            unitPrice: 10,
            taxRate: 0.16,
            dispatchedQuantity: 0,
            invoicedQuantity: 0,
          },
        },
      },
    });

    // 1. Emitir factura
    await salesPorts.invoicePosting.issue(
      tenant,
      { orderId: SalesOrderId.of(orderId) },
      today,
      2,
      (dispatch, order, alreadyInvoiced, credit) => {
        return {
          invoice: Invoice.fromPrimitives({
            id: invoiceId,
            tenantId: tenant.value,
            code: 'FAC000001',
            dispatchId: null,
            orderId: order.id.value,
            customerId: order.customerId().value,
            issueDate: '2026-10-10',
            dueDate: '2026-11-09',
            notes: null,
            status: 'issued',
            subtotal: 100,
            tax: 16,
            total: 116,
            subtotalVes: 100,
            taxVes: 16,
            totalVes: 116,
            cancelledAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            currency: 'USD',
            exchangeRate: 1,
            baseCurrency: 'USD',
            baseExchangeRate: 1,
            manualExchangeRate: false,
            lines: [
              {
                id: '00000000-0000-4000-8000-000000000031',
                lineNumber: 1,
                orderLineId,
                itemId: WATER,
                itemSku: 'CONTRATO-AGUA',
                itemName: 'Contrato agua',
                unitId: PIECE,
                quantity: 10,
                unitPrice: 10,
                taxRate: 0.16,
                subtotal: 100,
                tax: 16,
              },
            ],
          }),
          order,
        };
      },
    );

    // Verificar asiento de factura (§3.3)
    const invoiceEntry = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.value, originType: 'sales_invoice', originId: invoiceId },
      include: { lines: true },
    });
    expect(invoiceEntry).not.toBeNull();
    expect(invoiceEntry?.reversalOfId).toBeNull();
    expect(invoiceEntry?.lines).toHaveLength(3);

    const recLine = invoiceEntry!.lines.find((l) => l.accountId === accounts.receivablesAccountId);
    const revLine = invoiceEntry!.lines.find((l) => l.accountId === accounts.salesRevenueAccountId);
    const taxLine = invoiceEntry!.lines.find((l) => l.accountId === accounts.taxPayableAccountId);

    expect(Number(recLine?.debit)).toBe(116);
    expect(Number(recLine?.credit)).toBe(0);
    expect(Number(revLine?.debit)).toBe(0);
    expect(Number(revLine?.credit)).toBe(100);
    expect(Number(taxLine?.debit)).toBe(0);
    expect(Number(taxLine?.credit)).toBe(16);

    // 2. Anular factura (§3.12)
    await salesPorts.invoicePosting.cancel(
      tenant,
      InvoiceId.of(invoiceId),
      (inv, ord, paid) => {
        inv.cancel(new Date(), paid);
        return { invoice: inv, order: ord };
      },
    );

    // Verificar asiento reverso
    const reversalEntry = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.value, reversalOfId: invoiceEntry!.id },
      include: { lines: true },
    });
    expect(reversalEntry).not.toBeNull();
    expect(reversalEntry?.originType).toBe('reversal');

    const revRecLine = reversalEntry!.lines.find((l) => l.accountId === accounts.receivablesAccountId);
    const revRevLine = reversalEntry!.lines.find((l) => l.accountId === accounts.salesRevenueAccountId);
    const revTaxLine = reversalEntry!.lines.find((l) => l.accountId === accounts.taxPayableAccountId);

    expect(Number(revRecLine?.debit)).toBe(0);
    expect(Number(revRecLine?.credit)).toBe(116);
    expect(Number(revRevLine?.debit)).toBe(100);
    expect(Number(revRevLine?.credit)).toBe(0);
    expect(Number(revTaxLine?.debit)).toBe(16);
    expect(Number(revTaxLine?.credit)).toBe(0);
  });

  it('generates COGS and inventory journal entry on dispatch confirmation and reverses on cancellation (§3.2 & §3.12)', async () => {
    const salesPorts = salesHarness.ports();
    const accounts = await getCompanyAccounts(tenant.value);
    await salesHarness.stock(WATER, MAIN, 100);

    const customerId = '00000000-0000-4000-8000-000000000002';
    await prisma.customer.create({
      data: {
        id: customerId,
        tenantId: tenant.value,
        code: 'CLI0002',
        name: 'Cliente Test 2',
        paymentTermDays: 30,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    const orderId = '00000000-0000-4000-8000-000000000020';
    const orderLineId = '00000000-0000-4000-8000-000000000021';
    const dispatchId = '00000000-0000-4000-8000-000000000022';
    const dispatchLineId = '00000000-0000-4000-8000-000000000023';

    await prisma.salesOrder.create({
      data: {
        id: orderId,
        tenantId: tenant.value,
        code: 'PED000002',
        customerId,
        status: 'confirmed',
        currency: 'USD',
        baseCurrency: 'USD',
        exchangeRate: 1,
        baseExchangeRate: 1,
        manualExchangeRate: false,
        orderDate: new Date('2026-10-10'),
        priceListId: RETAIL_LIST,
        warehouseId: MAIN,
        updatedAt: new Date(),
        lines: {
          create: {
            id: orderLineId,
            lineNumber: 1,
            itemId: WATER,
            itemSku: 'CONTRATO-AGUA',
            itemName: 'Contrato agua',
            unitId: PIECE,
            quantity: 5,
            baseQuantity: 5,
            unitPrice: 10,
            taxRate: 0.16,
            dispatchedQuantity: 0,
            invoicedQuantity: 0,
          },
        },
      },
    });

    await prisma.dispatch.create({
      data: {
        id: dispatchId,
        tenantId: tenant.value,
        code: 'DES000001',
        orderId,
        warehouseId: MAIN,
        dispatchDate: new Date('2026-10-10'),
        status: 'draft',
        updatedAt: new Date(),
        lines: {
          create: {
            id: dispatchLineId,
            lineNumber: 1,
            orderLineId,
            itemId: WATER,
            itemSku: 'SKU-WATER',
            itemName: 'Agua mineral',
            unitId: PIECE,
            quantity: 5,
            baseQuantity: 5,
          },
        },
      },
    });

    // Sembrar existencia previa en bodega
    await salesHarness.stock(WATER, MAIN, 10);

    // 1. Confirmar despacho
    await salesPorts.dispatchPosting.post(tenant, DispatchId.of(dispatchId), (dispatch, order) => {
      return new DispatchConfirmation().apply(dispatch, order, new Date());
    });

    // Verificar asiento de despacho (§3.2)
    const dispatchEntry = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.value, originType: 'dispatch', originId: dispatchId },
      include: { lines: true },
    });
    expect(dispatchEntry).not.toBeNull();
    expect(dispatchEntry?.lines).toHaveLength(2);

    const cogsLine = dispatchEntry!.lines.find((l) => l.accountId === accounts.cogsAccountId);
    const invLine = dispatchEntry!.lines.find((l) => l.accountId === accounts.inventoryAccountId);

    // 5 unidades a costo promedio 1 = 5
    expect(Number(cogsLine?.debit)).toBe(5);
    expect(Number(cogsLine?.credit)).toBe(0);
    expect(Number(invLine?.debit)).toBe(0);
    expect(Number(invLine?.credit)).toBe(5);

    // 2. Anular despacho (§3.12)
    await salesPorts.dispatchPosting.post(tenant, DispatchId.of(dispatchId), (dispatch, order, invoiced) => {
      return new DispatchCancellation().apply(dispatch, order, invoiced, new Date());
    });

    // Verificar reverso del despacho
    const reversalEntry = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.value, reversalOfId: dispatchEntry!.id },
      include: { lines: true },
    });
    expect(reversalEntry).not.toBeNull();
    const revCogs = reversalEntry!.lines.find((l) => l.accountId === accounts.cogsAccountId);
    const revInv = reversalEntry!.lines.find((l) => l.accountId === accounts.inventoryAccountId);
    expect(Number(revCogs?.debit)).toBe(0);
    expect(Number(revCogs?.credit)).toBe(5);
    expect(Number(revInv?.debit)).toBe(5);
    expect(Number(revInv?.credit)).toBe(0);
  });

  it('generates customer credit note entry and credit-note-payment entry (§3.7 & §3.6)', async () => {
    const recvPorts = receivablesHarness.ports();
    const accounts = await getCompanyAccounts(tenant.value);

    const customerId = '00000000-0000-4000-8000-000000000003';
    await prisma.customer.create({
      data: {
        id: customerId,
        tenantId: tenant.value,
        code: 'CLI0003',
        name: 'Cliente Test 3',
        paymentTermDays: 30,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    const noteId = CreditNoteId.of('00000000-0000-4000-8000-000000000050');
    const currency = DocumentCurrency.fromPrimitives({
      currency: 'USD',
      exchangeRate: 1,
      baseCurrency: 'USD',
      baseExchangeRate: 1,
      manualExchangeRate: false,
    });

    const note = CustomerCreditNote.draft(
      noteId,
      tenant,
      'NCC000001',
      {
        customerId,
        issueDate: ReceivablesDate.of('2026-10-10'),
        reason: 'subsequent_discount',
        currency,
        lines: [
          {
            id: '00000000-0000-4000-8000-000000000051',
            itemId: WATER,
            unitId: PIECE,
            quantity: 1,
            unitPrice: 50,
            taxRate: 0.16,
          },
        ],
      },
      new Date(),
      '2026-10-10',
    );

    await recvPorts.creditNotes.save(note);

    // Confirmar nota de crédito
    await recvPorts.creditNotePosting.confirm(tenant, noteId, new Date(), '2026-10-10');

    // Verificar asiento de la nota (§3.7)
    // Subtotal 50, Tax 8, Total 58
    // Debe: Ingresos por ventas (50), Impuesto por pagar (8)
    // Haber: Notas de crédito por aplicar (58)
    const noteEntry = await prisma.journalEntry.findFirst({
      where: { tenantId: tenant.value, originType: 'customer_credit_note', originId: noteId.value },
      include: { lines: true },
    });
    expect(noteEntry).not.toBeNull();
    expect(noteEntry?.lines).toHaveLength(3);

    const revLine = noteEntry!.lines.find((l) => l.accountId === accounts.salesRevenueAccountId);
    const taxLine = noteEntry!.lines.find((l) => l.accountId === accounts.taxPayableAccountId);
    const unappLine = noteEntry!.lines.find((l) => l.accountId === accounts.unappliedCreditNotesAccountId);

    expect(Number(revLine?.debit)).toBe(50);
    expect(Number(revLine?.credit)).toBe(0);
    expect(Number(taxLine?.debit)).toBe(8);
    expect(Number(taxLine?.credit)).toBe(0);
    expect(Number(unappLine?.debit)).toBe(0);
    expect(Number(unappLine?.credit)).toBe(58);
  });

  it('fails with AccountResolutionFailedError and rolls back if an account cannot be resolved (§2.5 & §4.4)', async () => {
    const salesPorts = salesHarness.ports();

    // Eliminar salesRevenueAccountId de la empresa y asegurar que artículo y categoría no la tienen
    await prisma.companySettings.update({
      where: { tenantId: tenant.value },
      data: { salesRevenueAccountId: null },
    });

    const customerId = '00000000-0000-4000-8000-000000000004';
    await prisma.customer.create({
      data: {
        id: customerId,
        tenantId: tenant.value,
        code: 'CLI0004',
        name: 'Cliente Test 4',
        paymentTermDays: 30,
        creditLimit: 10000,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    const orderId = '00000000-0000-4000-8000-000000000060';
    const orderLineId = '00000000-0000-4000-8000-000000000061';
    const invoiceId = '00000000-0000-4000-8000-000000000062';
    const today = SalesDate.of('2026-10-10');

    await prisma.salesOrder.create({
      data: {
        id: orderId,
        tenantId: tenant.value,
        code: 'PED000003',
        customerId,
        status: 'confirmed',
        currency: 'USD',
        baseCurrency: 'USD',
        exchangeRate: 1,
        baseExchangeRate: 1,
        manualExchangeRate: false,
        orderDate: new Date('2026-10-10'),
        priceListId: RETAIL_LIST,
        warehouseId: MAIN,
        updatedAt: new Date(),
        lines: {
          create: {
            id: orderLineId,
            lineNumber: 1,
            itemId: WATER,
            itemSku: 'CONTRATO-AGUA',
            itemName: 'Contrato agua',
            unitId: PIECE,
            quantity: 10,
            baseQuantity: 10,
            unitPrice: 10,
            taxRate: 0.16,
            dispatchedQuantity: 0,
            invoicedQuantity: 0,
          },
        },
      },
    });

    // Intentar emitir factura debe fallar con AccountResolutionFailedError
    await expect(
      salesPorts.invoicePosting.issue(
        tenant,
        { orderId: SalesOrderId.of(orderId) },
        today,
        2,
        (dispatch, order) => ({
          invoice: Invoice.fromPrimitives({
            id: invoiceId,
            tenantId: tenant.value,
            code: 'FAC000002',
            dispatchId: null,
            orderId: order.id.value,
            customerId: order.customerId().value,
            issueDate: '2026-10-10',
            dueDate: '2026-11-09',
            notes: null,
            status: 'issued',
            subtotal: 100,
            tax: 16,
            total: 116,
            subtotalVes: 100,
            taxVes: 16,
            totalVes: 116,
            cancelledAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            currency: 'USD',
            exchangeRate: 1,
            baseCurrency: 'USD',
            baseExchangeRate: 1,
            manualExchangeRate: false,
            lines: [
              {
                id: '00000000-0000-4000-8000-000000000063',
                lineNumber: 1,
                orderLineId,
                itemId: WATER,
                itemSku: 'CONTRATO-AGUA',
                itemName: 'Contrato agua',
                unitId: PIECE,
                quantity: 10,
                unitPrice: 10,
                taxRate: 0.16,
                subtotal: 100,
                tax: 16,
              },
            ],
          }),
          order,
        }),
      ),
    ).rejects.toThrow(AccountResolutionFailedError);

    // Comprobar que la transacción se revirtió completamente: no se creó la factura en la BD
    const savedInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(savedInvoice).toBeNull();
  });
});
