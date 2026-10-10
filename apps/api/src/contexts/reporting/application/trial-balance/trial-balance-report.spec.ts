import { describe, expect, it } from 'vitest';
import { InMemoryReportingReadModel } from '../../infrastructure/testing/in-memory-reporting-read-model.js';
import { TrialBalanceReport } from './trial-balance-report.js';

describe('TrialBalanceReport', () => {
  const dummyRates = {
    amountDecimals: async () => 2,
    companyCurrency: async () => 'USD',
  } as any;

  it('computes balanced totals when sum of debit equals sum of credit (§4.5)', async () => {
    const readModel = new InMemoryReportingReadModel();
    readModel.trialBalanceRow('00000000-0000-4000-8000-000000000001', {
      accountId: 'acc-1',
      code: '1.1.01',
      name: 'Caja',
      type: 'asset',
      debit: 150,
      credit: 0,
    });
    readModel.trialBalanceRow('00000000-0000-4000-8000-000000000001', {
      accountId: 'acc-2',
      code: '2.1.01',
      name: 'Proveedores por pagar',
      type: 'liability',
      debit: 0,
      credit: 150,
    });

    const report = new TrialBalanceReport(readModel, dummyRates);
    const result = await report.run({ tenantId: '00000000-0000-4000-8000-000000000001' });

    expect(result.totals.debit).toBe(150);
    expect(result.totals.credit).toBe(150);
    expect(result.totals.difference).toBe(0);
    expect(result.totals.isBalanced).toBe(true);

    // Saldo segun naturaleza
    expect(result.rows[0].balance).toBe(150); // Activo: 150 - 0 = 150
    expect(result.rows[1].balance).toBe(150); // Pasivo: 150 - 0 = 150
  });

  it('detects unbalanced condition if debits do not equal credits', async () => {
    const readModel = new InMemoryReportingReadModel();
    readModel.trialBalanceRow('00000000-0000-4000-8000-000000000001', {
      accountId: 'acc-1',
      code: '1.1.01',
      name: 'Caja',
      type: 'asset',
      debit: 100,
      credit: 0,
    });

    const report = new TrialBalanceReport(readModel, dummyRates);
    const result = await report.run({ tenantId: '00000000-0000-4000-8000-000000000001' });

    expect(result.totals.debit).toBe(100);
    expect(result.totals.credit).toBe(0);
    expect(result.totals.difference).toBe(100);
    expect(result.totals.isBalanced).toBe(false);
  });

  it('paginates rows correctly while totals include all accounts', async () => {
    const readModel = new InMemoryReportingReadModel();
    for (let i = 1; i <= 5; i++) {
      readModel.trialBalanceRow('00000000-0000-4000-8000-000000000001', {
        accountId: `acc-${i}`,
        code: `1.1.0${i}`,
        name: `Cuenta ${i}`,
        type: 'asset',
        debit: 10,
        credit: 0,
      });
    }

    const report = new TrialBalanceReport(readModel, dummyRates);
    const result = await report.run({
      tenantId: '00000000-0000-4000-8000-000000000001',
      limit: 2,
      offset: 0,
    });

    expect(result.page.total).toBe(5);
    expect(result.rows).toHaveLength(2);
    expect(result.totals.debit).toBe(50);
  });
});
