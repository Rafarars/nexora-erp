import { describe, expect, it } from 'vitest';
import { ReportCustomerNotFoundError, ReportPeriodTooLongError, ReportWarehouseNotFoundError } from '../domain/errors/reporting.errors.js';
import { DELTA, MAIN, NORTH, OMEGA, TENANT_A, TENANT_B, aCustomer, aStock, anInvoice } from '../domain/testing/reporting.mother.js';
import { InMemoryInvoice } from '../infrastructure/testing/in-memory-reporting-read-model.js';
import { companyHeader, customerStatementDocument, inventoryValuationDocument, receivablesAgingDocument, salesByCustomerDocument } from './documents/report-documents.js';
import { stockValueCents } from './search-dashboard/dashboard-searcher.js';
import { aReportingScenario } from './testing/reporting-scenario.js';

const invoice = (overrides: Partial<InMemoryInvoice>): InMemoryInvoice => ({
  ...anInvoice(),
  subtotal: 86.21,
  tax: 13.79,
  lines: [{ itemId: 'water', sku: 'AGUA-500', name: 'Agua', subtotal: 86.21 }],
  ...overrides,
});

// Hoy es 15 de marzo. Delta debe dos facturas (una vencida) y pago parte; Omega compro en febrero.
function world() {
  const s = aReportingScenario();

  s.readModel.customer(TENANT_A, aCustomer());
  s.readModel.customer(TENANT_A, aCustomer({ id: OMEGA, code: 'CLI000002', name: 'Talleres Omega', fiscalId: null, paymentTermDays: 0, creditLimit: null }));
  s.readModel.invoice(TENANT_A, invoice({ id: 'i1', code: 'FAC000001', issueDate: '2026-03-01', dueDate: '2026-03-10', total: 100, paid: 40 }));
  s.readModel.invoice(TENANT_A, invoice({ id: 'i2', code: 'FAC000002', issueDate: '2026-03-12', dueDate: '2026-03-27', total: 50.5, subtotal: 43.53, tax: 6.97, paid: 0, lines: [{ itemId: 'soap', sku: 'JABON', name: 'Jabón', subtotal: 43.53 }] }));
  s.readModel.invoice(TENANT_A, invoice({ id: 'i3', code: 'FAC000003', customerId: OMEGA, issueDate: '2026-02-20', dueDate: '2026-02-20', total: 30, subtotal: 30, tax: 0, paid: 30 }));
  s.readModel.payment(TENANT_A, { code: 'COB000001', customerId: DELTA, date: '2026-03-11', amount: 40 });
  s.readModel.payment(TENANT_A, { code: 'COB000002', customerId: OMEGA, date: '2026-02-21', amount: 30 });
  s.readModel.receipt(TENANT_A, { date: '2026-03-02', amount: 120 });
  s.readModel.receipt(TENANT_A, { date: '2026-02-28', amount: 999 });
  s.readModel.stockRow(TENANT_A, aStock());
  s.readModel.stockRow(TENANT_A, aStock({ warehouseId: NORTH, warehouseName: 'Norte', sku: 'JABON', itemId: 'soap', name: 'Jabón', baseUnit: 'kg', quantity: 2.5, averageCost: 3.333333 }));
  s.readModel.customer(TENANT_B, aCustomer({ id: 'foreign', name: 'Ajeno' }));
  s.readModel.invoice(TENANT_B, invoice({ id: 'x', customerId: 'foreign', total: 5000 }));

  return s;
}

describe('dashboard', () => {
  it('adds up this month and today, never another company', async () => {
    const dashboard = await world().dashboard.run({ tenantId: TENANT_A });

    expect(dashboard).toMatchObject({
      period: { from: '2026-03-01', to: '2026-03-15' },
      salesThisMonth: 150.5,
      purchasesThisMonth: 120,
      collectedThisMonth: 40,
      receivableBalance: 110.5,
      overdueBalance: 60,
      inventoryValue: 152.33,
    });
    expect(dashboard.topDebtors).toEqual([{ customer: { id: DELTA, code: 'CLI000001', name: 'Comercial Delta' }, balance: 110.5, overdue: 60 }]);
    expect(dashboard.topItems.map((row) => [row.item.sku, row.subtotal])).toEqual([
      ['AGUA-500', 86.21],
      ['JABON', 43.53],
    ]);
  });

  it('values stock in cents per row: 2,5 kg at 3,333333 is 8,33', () => {
    expect(stockValueCents(2.5, 3.333333)).toBe(833n);
    expect(stockValueCents(0.0001, 0.000001)).toBe(0n);
  });
});

describe('receivables aging report', () => {
  it('lists only who owes, and turns into a document with the same figures', async () => {
    const report = await world().receivablesAging.run({ tenantId: TENANT_A });

    expect(report.customers).toEqual([{ customer: { id: DELTA, code: 'CLI000001', name: 'Comercial Delta' }, aging: { current: 50.5, days1To30: 60, days31To60: 0, days61To90: 0, over90: 0, total: 110.5 } }]);

    const document = receivablesAgingDocument(report, 'Acme Industrial');
    expect(document.subtitle).toEqual(['Acme Industrial', 'Al 2026-03-15']);
    expect(document.rows).toEqual([{ code: 'CLI000001', customer: 'Comercial Delta', current: 50.5, days1To30: 60, days31To60: 0, days61To90: 0, over90: 0, total: 110.5 }]);
    expect(document.totals).toMatchObject({ code: 'Total', total: 110.5 });
  });
});

describe('customer statement report', () => {
  it('runs the balance down to what the invoices owe', async () => {
    const report = await world().customerStatement.run({ tenantId: TENANT_A, customerId: DELTA });

    expect(report.movements.map((row) => [row.code, row.debit, row.credit, row.balance])).toEqual([
      ['FAC000001', 100, 0, 100],
      ['COB000001', 0, 40, 60],
      ['FAC000002', 50.5, 0, 110.5],
    ]);
    expect([report.balance, report.overdue]).toEqual([110.5, 60]);
    expect(customerStatementDocument(report, 'Acme Industrial').subtitle).toContain('Plazo 15 días · Límite 1000.00');
  });

  it('does not exist for another company', async () => {
    await expect(world().customerStatement.run({ tenantId: TENANT_B, customerId: DELTA })).rejects.toThrow(ReportCustomerNotFoundError);
  });
});

describe('sales by customer report', () => {
  it('adds what was invoiced in the period, the biggest buyer first', async () => {
    const s = world();

    const march = await s.salesByCustomer.run({ tenantId: TENANT_A, from: '2026-03-01', to: '2026-03-31' });
    expect(march.customers).toEqual([{ customer: { id: DELTA, code: 'CLI000001', name: 'Comercial Delta' }, invoices: 2, subtotal: 129.74, tax: 20.76, total: 150.5 }]);

    const quarter = await s.salesByCustomer.run({ tenantId: TENANT_A, from: '2026-01-01', to: '2026-03-31' });
    expect(quarter.customers.map((row) => row.customer.name)).toEqual(['Comercial Delta', 'Talleres Omega']);
    expect(quarter.totals).toEqual({ invoices: 3, subtotal: 159.74, tax: 20.76, total: 180.5 });
    expect(salesByCustomerDocument(quarter, 'Acme').fileName).toBe('ventas-por-cliente-2026-01-01-a-2026-03-31');
  });

  it('refuses a period longer than a year', async () => {
    await expect(world().salesByCustomer.run({ tenantId: TENANT_A, from: '2025-01-01', to: '2026-03-31' })).rejects.toThrow(ReportPeriodTooLongError);
  });
});

describe('inventory valuation report', () => {
  it('values each row and totals it, optionally for one warehouse', async () => {
    const s = world();

    const all = await s.inventoryValuation.run({ tenantId: TENANT_A });
    expect(all.rows.map((row) => [row.warehouse.name, row.item.sku, row.value])).toEqual([
      ['Norte', 'JABON', 8.33],
      ['Principal', 'AGUA-500', 144],
    ]);
    expect(all.totalValue).toBe(152.33);

    const main = await s.inventoryValuation.run({ tenantId: TENANT_A, warehouseId: MAIN });
    expect(inventoryValuationDocument(main, 'Acme', 'Principal').totals).toMatchObject({ value: 144 });
  });

  it('answers as missing a warehouse of another company', async () => {
    await expect(world().inventoryValuation.run({ tenantId: TENANT_B, warehouseId: MAIN })).rejects.toThrow(ReportWarehouseNotFoundError);
  });
});

describe('companyHeader', () => {
  it('names who issues the report with its fiscal id', () => {
    expect(companyHeader({ name: 'Acme Industrial, C.A.', fiscalId: 'J-40000001-2' })).toBe('Acme Industrial, C.A. · RIF J-40000001-2');
  });

  it('leaves the fiscal id out when the company never filled it', () => {
    expect(companyHeader({ name: 'Acme Industrial', fiscalId: null })).toBe('Acme Industrial');
  });
});
