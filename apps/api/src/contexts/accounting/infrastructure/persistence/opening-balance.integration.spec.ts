import { ConfigService } from '@nestjs/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Env } from '../../../../shared/config/env.schema.js';
import { FixedDocumentRates } from '../../../../shared/infrastructure/testing/fixed-document-rates.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PrismaPayableBalances } from '../../../payables/infrastructure/persistence/prisma-payable-balances.js';
import { PrismaPayablesLedger } from '../../../payables/infrastructure/persistence/prisma-payables-ledger.js';
import { PrismaReceivableBalances } from '../../../receivables/infrastructure/persistence/prisma-receivable-balances.js';
import { PrismaReportingReadModel } from '../../../reporting/infrastructure/persistence/prisma-reporting-read-model.js';
import { GenerateOpeningBalanceUseCase } from '../../application/generate-opening-balance/generate-opening-balance.use-case.js';
import {
  NoOpeningBalancesFoundError,
  OpeningBalanceAlreadyExistsError,
} from '../../domain/errors/accounting.errors.js';
import { seedAccountingForTenant } from '../testing/accounting-seed.helper.js';
import { PrismaDocumentAccountingPosting } from './prisma-document-accounting-posting.js';
import { PrismaOpeningBalanceReader } from './prisma-opening-balance-reader.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return url;
}

describe('Asiento de Apertura Contable (§3.13) - Integration', () => {
  const prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  const tenantId = 'a0000000-0000-4000-8000-000000000001';
  const tenant = TenantId.of(tenantId);

  const calendar = { today: async () => '2026-10-10' };
  const rates = new FixedDocumentRates();

  const idGen = new SequentialIdGenerator();
  const posting = new PrismaDocumentAccountingPosting();
  const payablesLedger = new PrismaPayablesLedger(prisma);
  const payableBalances = new PrismaPayableBalances(payablesLedger, calendar, rates);
  const receivableBalances = new PrismaReceivableBalances();
  const reader = new PrismaOpeningBalanceReader(prisma);
  const readModel = new PrismaReportingReadModel(prisma, payableBalances);

  const useCase = new GenerateOpeningBalanceUseCase(
    reader,
    posting,
    rates,
    calendar,
    idGen,
    prisma,
  );

  beforeEach(async () => {
    // Limpiar asientos, líneas, existencias y documentos para tenant
    await prisma.journalEntryLine.deleteMany({ where: { tenantId } });
    await prisma.journalEntry.deleteMany({ where: { tenantId } });
    await prisma.itemStock.deleteMany({ where: { tenantId } });
    await prisma.paymentAllocation.deleteMany({ where: { tenantId } });
    await prisma.customerPayment.deleteMany({ where: { tenantId } });
    await prisma.invoiceLine.deleteMany({ where: { tenantId } });
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.salesOrder.deleteMany({ where: { tenantId } });
    await prisma.supplierPaymentAllocation.deleteMany({ where: { tenantId } });
    await prisma.supplierPayment.deleteMany({ where: { tenantId } });
    await prisma.purchaseInvoiceLine.deleteMany({ where: { tenantId } });
    await prisma.purchaseInvoice.deleteMany({ where: { tenantId } });

    await prisma.tenant.upsert({
      where: { id: tenantId },
      create: { id: tenantId, name: 'Empresa Test', slug: 'empresa-test' },
      update: {},
    });

    await seedAccountingForTenant(prisma, tenantId);
  });

  afterAll(async () => {
    await prisma.journalEntryLine.deleteMany({ where: { tenantId } });
    await prisma.journalEntry.deleteMany({ where: { tenantId } });
    await prisma.$disconnect();
  });

  it('rechaza si no hay saldos vivos que registrar', async () => {
    await expect(useCase.execute({ tenantId })).rejects.toThrow(NoOpeningBalancesFoundError);
  });

  it('genera asiento de apertura cuadrado al centavo con saldos vivos de inventario, clientes y proveedores (§3.13)', async () => {
    const settings = await prisma.companySettings.findUniqueOrThrow({ where: { tenantId } });

    // 1. Inventario: 10 unidades a costo promedio 5.00 = 50.00
    const warehouseId = '00000000-0000-1000-8000-000000000001';
    const itemId = '00000000-0000-2000-8000-000000000001';

    await prisma.warehouse.upsert({
      where: { id: warehouseId },
      create: { id: warehouseId, tenantId, code: 'BOD01', name: 'Bodega Principal', isActive: true, updatedAt: new Date() },
      update: {},
    });

    await prisma.item.upsert({
      where: { id: itemId },
      create: {
        id: itemId,
        tenantId,
        code: 'ART0001',
        sku: 'AGUA-01',
        name: 'Agua Mineral',
        type: 'inventoried',
        isActive: true,
        updatedAt: new Date(),
      },
      update: {},
    });

    await prisma.itemStock.upsert({
      where: { tenantId_itemId_warehouseId: { tenantId, itemId, warehouseId } },
      create: {
        tenantId,
        itemId,
        warehouseId,
        quantity: 10,
        averageCost: 5,
        updatedAt: new Date(),
      },
      update: {
        quantity: 10,
        averageCost: 5,
        updatedAt: new Date(),
      },
    });

    // 2. Clientes por cobrar: Factura emitida de 70.00 sin pagos
    const customerId = '00000000-0000-3000-8000-000000000001';
    await prisma.customer.upsert({
      where: { id: customerId },
      create: { id: customerId, tenantId, code: 'CLI01', name: 'Cliente A', paymentTermDays: 30, isActive: true, updatedAt: new Date() },
      update: {},
    });

    const orderId = '00000000-0000-4000-8000-000000000010';
    await prisma.salesOrder.create({
      data: {
        id: orderId,
        tenantId,
        code: 'PED-0001',
        customerId,
        warehouseId,
        orderDate: new Date('2026-10-01'),
        status: 'confirmed',
        currency: 'USD',
        baseCurrency: 'USD',
        exchangeRate: 1,
        baseExchangeRate: 1,
        manualExchangeRate: false,
        updatedAt: new Date(),
      },
    });

    const invoiceId = '00000000-0000-4000-8000-000000000001';
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        tenantId,
        code: 'FAC-0001',
        orderId,
        customerId,
        issueDate: new Date('2026-10-01'),
        dueDate: new Date('2026-10-31'),
        status: 'issued',
        currency: 'USD',
        baseCurrency: 'USD',
        exchangeRate: 1,
        baseExchangeRate: 1,
        manualExchangeRate: false,
        total: 70,
        subtotal: 70,
        tax: 0,
        updatedAt: new Date(),
      },
    });

    // 3. Proveedores por pagar: Factura de compra confirmada de 40.00 sin pagos
    const supplierId = '00000000-0000-5000-8000-000000000001';
    await prisma.supplier.upsert({
      where: { id: supplierId },
      create: { id: supplierId, tenantId, code: 'PRV01', name: 'Proveedor B', paymentTermDays: 30, isActive: true, updatedAt: new Date() },
      update: {},
    });

    const purchaseInvoiceId = '00000000-0000-6000-8000-000000000001';
    await prisma.purchaseInvoice.create({
      data: {
        id: purchaseInvoiceId,
        tenantId,
        code: 'FCP-0001',
        supplierId,
        supplierInvoiceNumber: 'INV-999',
        issueDate: new Date('2026-10-01'),
        dueDate: new Date('2026-10-31'),
        status: 'confirmed',
        currency: 'USD',
        baseCurrency: 'USD',
        exchangeRate: 1,
        baseExchangeRate: 1,
        total: 40,
        subtotal: 40,
        tax: 0,
        updatedAt: new Date(),
      },
    });

    // Ejecutar el Asiento de Apertura
    const result = await useCase.execute({ tenantId });

    // Activo = 50 + 70 = 120
    // Pasivo = 40
    // Patrimonio = 120 - 40 = 80
    expect(result.inventoryTotal).toBe(50);
    expect(result.receivablesTotal).toBe(70);
    expect(result.payablesTotal).toBe(40);
    expect(result.equityTotal).toBe(80);

    // Verificar en la base de datos
    const entry = await prisma.journalEntry.findFirst({
      where: { tenantId, originType: 'opening_balance' },
      include: { lines: true },
    });

    expect(entry).not.toBeNull();
    expect(entry!.description).toBe('Asiento de apertura de saldos vivos iniciales');
    expect(entry!.lines).toHaveLength(4);

    const invLine = entry!.lines.find((l) => l.accountId === settings.inventoryAccountId);
    const recLine = entry!.lines.find((l) => l.accountId === settings.receivablesAccountId);
    const payLine = entry!.lines.find((l) => l.accountId === settings.payablesAccountId);
    const eqLine = entry!.lines.find((l) => l.accountId === settings.openingEquityAccountId);

    expect(invLine).toBeDefined();
    expect(Number(invLine!.debit)).toBe(50);
    expect(Number(invLine!.credit)).toBe(0);

    expect(recLine).toBeDefined();
    expect(Number(recLine!.debit)).toBe(70);
    expect(Number(recLine!.credit)).toBe(0);

    expect(payLine).toBeDefined();
    expect(Number(payLine!.debit)).toBe(0);
    expect(Number(payLine!.credit)).toBe(40);

    expect(eqLine).toBeDefined();
    expect(Number(eqLine!.debit)).toBe(0);
    expect(Number(eqLine!.credit)).toBe(80);

    // Invariante de partida doble: Débito (50 + 70 = 120) === Crédito (40 + 80 = 120)
    const totalDebit = entry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = entry!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(120);
    expect(totalCredit).toBe(120);

    // 4. Balanza de Comprobación: debe arrancar perfectamente cuadrada
    const trialBalance = await readModel.trialBalance(tenant);
    expect(trialBalance.length).toBeGreaterThanOrEqual(4);

    const trialDebit = trialBalance.reduce((s, r) => s + r.debit, 0);
    const trialCredit = trialBalance.reduce((s, r) => s + r.credit, 0);
    expect(trialDebit).toBe(120);
    expect(trialCredit).toBe(120);

    // 5. Rechaza intento de duplicar el asiento de apertura
    await expect(useCase.execute({ tenantId })).rejects.toThrow(OpeningBalanceAlreadyExistsError);
  });

  it('genera asiento de apertura con déficit (Pasivo > Activo), imputando Patrimonio al Debe (§3.13)', async () => {
    const settings = await prisma.companySettings.findUniqueOrThrow({ where: { tenantId } });

    // Proveedor por pagar de 100, sin inventario ni clientes
    const supplierId = '00000000-0000-5000-8000-000000000002';
    await prisma.supplier.upsert({
      where: { id: supplierId },
      create: { id: supplierId, tenantId, code: 'PRV02', name: 'Proveedor Deficit', paymentTermDays: 30, isActive: true, updatedAt: new Date() },
      update: {},
    });

    const purchaseInvoiceId = '00000000-0000-6000-8000-000000000002';
    await prisma.purchaseInvoice.create({
      data: {
        id: purchaseInvoiceId,
        tenantId,
        code: 'FCP-0002',
        supplierId,
        supplierInvoiceNumber: 'INV-DEFICIT',
        issueDate: new Date('2026-10-01'),
        dueDate: new Date('2026-10-31'),
        status: 'confirmed',
        currency: 'USD',
        baseCurrency: 'USD',
        exchangeRate: 1,
        baseExchangeRate: 1,
        total: 100,
        subtotal: 100,
        tax: 0,
        updatedAt: new Date(),
      },
    });

    const result = await useCase.execute({ tenantId });
    expect(result.inventoryTotal).toBe(0);
    expect(result.receivablesTotal).toBe(0);
    expect(result.payablesTotal).toBe(100);
    expect(result.equityTotal).toBe(-100);

    const entry = await prisma.journalEntry.findFirst({
      where: { tenantId, originType: 'opening_balance' },
      include: { lines: true },
    });

    expect(entry).not.toBeNull();
    const payLine = entry!.lines.find((l) => l.accountId === settings.payablesAccountId);
    const eqLine = entry!.lines.find((l) => l.accountId === settings.openingEquityAccountId);

    expect(payLine).toBeDefined();
    expect(Number(payLine!.debit)).toBe(0);
    expect(Number(payLine!.credit)).toBe(100);

    // Con déficit, Patrimonio de apertura se debita para equilibrar la partida doble
    expect(eqLine).toBeDefined();
    expect(Number(eqLine!.debit)).toBe(100);
    expect(Number(eqLine!.credit)).toBe(0);

    const totalDebit = entry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = entry!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(100);
    expect(totalCredit).toBe(100);
  });
});
