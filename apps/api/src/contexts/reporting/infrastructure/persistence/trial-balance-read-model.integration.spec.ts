import { ConfigService } from '@nestjs/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Env } from '../../../../shared/config/env.schema.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { seedAccountingForTenant } from '../../../accounting/infrastructure/testing/accounting-seed.helper.js';
import { PrismaReportingReadModel } from './prisma-reporting-read-model.js';
import { PAYABLE_BALANCES } from '../../../../shared/prisma/payable-balances.js';

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return url;
}

const TENANT_A = '00000000-0000-4000-8000-000000000001';
const TENANT_B = '00000000-0000-4000-8000-000000000002';

describe('Trial Balance Read Model: PostgreSQL integration', () => {
  const prisma = new PrismaService(new ConfigService<Env, true>({ DATABASE_URL: connectionString() }));
  const dummyPayableBalances = {} as any;
  const readModel = new PrismaReportingReadModel(prisma, dummyPayableBalances);

  beforeEach(async () => {
    // Limpieza de asientos previos de prueba
    await prisma.journalEntryLine.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.journalEntry.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });

    await prisma.tenant.upsert({
      where: { id: TENANT_A },
      create: { id: TENANT_A, name: 'Empresa A', slug: 'empresa-a' },
      update: {},
    });
    await prisma.tenant.upsert({
      where: { id: TENANT_B },
      create: { id: TENANT_B, name: 'Empresa B', slug: 'empresa-b' },
      update: {},
    });

    await seedAccountingForTenant(prisma, TENANT_A);
    await seedAccountingForTenant(prisma, TENANT_B);
  });

  afterAll(async () => {
    await prisma.journalEntryLine.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.journalEntry.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.$disconnect();
  });

  it('calculates trial balance with total debits equal to total credits (§4.5)', async () => {
    const cashAccount = await prisma.account.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: TENANT_A, code: '1.1.01.001' } },
    });
    const capitalAccount = await prisma.account.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: TENANT_A, code: '3.1.01.001' } },
    });

    // Asiento cuadrado: Debe Caja 500, Haber Capital 500
    const entryId = '00000000-0000-4000-8000-000000000100';
    await prisma.journalEntry.create({
      data: {
        id: entryId,
        tenantId: TENANT_A,
        code: 'ASI-000001',
        entryDate: new Date('2026-10-10'),
        originType: 'manual',
        originId: entryId,
        description: 'Aporte de capital inicial',
        currency: 'USD',
        lines: {
          create: [
            {
              id: '00000000-0000-4000-8000-000000000101',
              tenantId: TENANT_A,
              accountId: cashAccount.id,
              debit: 500,
              credit: 0,
              label: 'Debe caja',
            },
            {
              id: '00000000-0000-4000-8000-000000000102',
              tenantId: TENANT_A,
              accountId: capitalAccount.id,
              debit: 0,
              credit: 500,
              label: 'Haber capital',
            },
          ],
        },
      },
    });

    const rows = await readModel.trialBalance(TenantId.of(TENANT_A));
    expect(rows.length).toBeGreaterThan(0);

    const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);

    expect(totalDebit).toBe(500);
    expect(totalCredit).toBe(500);
    expect(totalDebit).toBe(totalCredit);

    const cashRow = rows.find((r) => r.code === '1.1.01.001');
    const capitalRow = rows.find((r) => r.code === '3.1.01.001');

    expect(cashRow?.debit).toBe(500);
    expect(cashRow?.credit).toBe(0);
    expect(capitalRow?.debit).toBe(0);
    expect(capitalRow?.credit).toBe(500);
  });

  it('filters by date range (from / to) and respects tenant isolation', async () => {
    const cashAccountA = await prisma.account.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: TENANT_A, code: '1.1.01.001' } },
    });
    const capitalAccountA = await prisma.account.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: TENANT_A, code: '3.1.01.001' } },
    });
    const cashAccountB = await prisma.account.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: TENANT_B, code: '1.1.01.001' } },
    });
    const capitalAccountB = await prisma.account.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: TENANT_B, code: '3.1.01.001' } },
    });

    // Asiento A1 en 2026-10-01: 200
    await prisma.journalEntry.create({
      data: {
        id: '00000000-0000-4000-8000-000000000200',
        tenantId: TENANT_A,
        code: 'ASI-000002',
        entryDate: new Date('2026-10-01'),
        originType: 'manual',
        originId: '00000000-0000-4000-8000-000000000200',
        description: 'Movimiento 1',
        currency: 'USD',
        lines: {
          create: [
            { id: '00000000-0000-4000-8000-000000000201', tenantId: TENANT_A, accountId: cashAccountA.id, debit: 200, credit: 0, label: 'L1' },
            { id: '00000000-0000-4000-8000-000000000202', tenantId: TENANT_A, accountId: capitalAccountA.id, debit: 0, credit: 200, label: 'L2' },
          ],
        },
      },
    });

    // Asiento A2 en 2026-10-15: 300
    await prisma.journalEntry.create({
      data: {
        id: '00000000-0000-4000-8000-000000000210',
        tenantId: TENANT_A,
        code: 'ASI-000003',
        entryDate: new Date('2026-10-15'),
        originType: 'manual',
        originId: '00000000-0000-4000-8000-000000000210',
        description: 'Movimiento 2',
        currency: 'USD',
        lines: {
          create: [
            { id: '00000000-0000-4000-8000-000000000211', tenantId: TENANT_A, accountId: cashAccountA.id, debit: 300, credit: 0, label: 'L1' },
            { id: '00000000-0000-4000-8000-000000000212', tenantId: TENANT_A, accountId: capitalAccountA.id, debit: 0, credit: 300, label: 'L2' },
          ],
        },
      },
    });

    // Asiento B en TENANT_B: 999
    await prisma.journalEntry.create({
      data: {
        id: '00000000-0000-4000-8000-000000000220',
        tenantId: TENANT_B,
        code: 'ASI-000004',
        entryDate: new Date('2026-10-01'),
        originType: 'manual',
        originId: '00000000-0000-4000-8000-000000000220',
        description: 'Movimiento de otra empresa',
        currency: 'USD',
        lines: {
          create: [
            { id: '00000000-0000-4000-8000-000000000221', tenantId: TENANT_B, accountId: cashAccountB.id, debit: 999, credit: 0, label: 'L1' },
            { id: '00000000-0000-4000-8000-000000000222', tenantId: TENANT_B, accountId: capitalAccountB.id, debit: 0, credit: 999, label: 'L2' },
          ],
        },
      },
    });

    // Rango del 2026-10-01 al 2026-10-10: solo debe incluir A1 (200), nada de A2 ni de TENANT_B
    const filteredRows = await readModel.trialBalance(TenantId.of(TENANT_A), '2026-10-01', '2026-10-10');
    const filteredDebit = filteredRows.reduce((sum, r) => sum + r.debit, 0);
    const filteredCredit = filteredRows.reduce((sum, r) => sum + r.credit, 0);

    expect(filteredDebit).toBe(200);
    expect(filteredCredit).toBe(200);
  });
});
