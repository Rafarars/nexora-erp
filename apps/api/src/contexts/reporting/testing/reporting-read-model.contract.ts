import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReportPeriod } from '../domain/period/report-period.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { DELTA, OMEGA, TENANT_A, TENANT_B, aCustomer } from '../domain/testing/reporting.mother.js';
import { ReportingReadModelHarness, SeedInvoice } from './reporting-read-model.harness.js';

const tenant = TenantId.of(TENANT_A);
// Catalogo propio: los contratos de los demas contextos siembran el suyo con otros identificadores y
// corren contra la misma base.
const WATER = 'a7111111-1111-4111-8111-111111111111';
const SOAP = 'a7555555-5555-4555-8555-555555555555';
const MAIN = 'b7311111-1111-4111-8111-111111111111';
const NORTH = 'b7322222-2222-4222-8222-222222222222';
const FOREIGN_CUSTOMER = 'c9999999-9999-4999-8999-999999999999';
const FOREIGN_WAREHOUSE = 'b7399999-9999-4999-8999-999999999999';
const FOREIGN_ITEM = 'a7999999-9999-4999-8999-999999999999';

const invoiceId = (n: number) => `f7000000-0000-4000-8000-00000000000${n}`;
const march = ReportPeriod.of('2026-03-01', '2026-03-31');

// UNA suite para el doble y para PostgreSQL. Lo que importa: que cada suma cuente solo lo que debe
// (emitido, confirmado, dentro del periodo, de la empresa) y que no se pierdan centimos.
export function describeReportingReadModelContract(implementation: string, createHarness: () => ReportingReadModelHarness): void {
  describe(`Reporting read model contract: ${implementation}`, () => {
    const harness = createHarness();

    const invoice = (n: number, overrides: Partial<SeedInvoice> = {}): SeedInvoice => ({
      id: invoiceId(n),
      code: `FAC90000${n}`,
      customerId: DELTA,
      issueDate: '2026-03-05',
      dueDate: '2026-03-20',
      status: 'issued',
      subtotal: 10,
      tax: 1.6,
      total: 11.6,
      lines: [{ itemId: WATER, subtotal: 10 }],
      ...overrides,
    });

    beforeEach(async () => {
      await harness.reset();
      await harness.company(TENANT_A, 'Contrato Acme', { legalName: 'Contrato Acme, C.A.', fiscalId: 'J-40000001-2' });
      await harness.company(TENANT_B, 'Contrato Globex');
      await harness.customer(TENANT_A, aCustomer({ code: 'CLI910001', name: 'Contrato Delta', creditLimit: 1000.5 }));
      await harness.customer(TENANT_A, aCustomer({ id: OMEGA, code: 'CLI910002', name: 'Contrato Omega', fiscalId: null, paymentTermDays: 0, creditLimit: null }));
      await harness.customer(TENANT_B, aCustomer({ id: FOREIGN_CUSTOMER, code: 'CLI910001', name: 'Contrato ajeno' }));
      await harness.warehouse(TENANT_A, { id: MAIN, name: 'Reporte principal' });
      await harness.warehouse(TENANT_A, { id: NORTH, name: 'Reporte norte' });
      await harness.warehouse(TENANT_B, { id: FOREIGN_WAREHOUSE, name: 'Reporte ajena' });
      await harness.item(TENANT_A, { id: WATER, sku: 'REPORTE-AGUA', name: 'Reporte agua', baseUnit: 'rcu' });
      await harness.item(TENANT_A, { id: SOAP, sku: 'REPORTE-JABON', name: 'Reporte jabón', baseUnit: 'rck' });
      await harness.item(TENANT_B, { id: FOREIGN_ITEM, sku: 'REPORTE-AJENO', name: 'Contrato ajeno', baseUnit: 'rcu' });
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    it('reads who issues the reports and its customers with their credit limit', async () => {
      const readModel = harness.readModel();

      expect(await readModel.company(tenant)).toEqual({ name: 'Contrato Acme, C.A.', fiscalId: 'J-40000001-2' });
      // Sin datos llenos, el nombre con que se registro.
      expect(await readModel.company(TenantId.of(TENANT_B))).toEqual({ name: 'Contrato Globex', fiscalId: null });
      expect((await readModel.customers(tenant)).map((row) => [row.name, row.creditLimit, row.paymentTermDays])).toEqual([
        ['Contrato Delta', 1000.5, 15],
        ['Contrato Omega', null, 0],
      ]);
    });

    it('counts as paid only confirmed payments, and leaves out cancelled invoices and other companies', async () => {
      await harness.invoice(TENANT_A, invoice(1, { total: 100 }));
      await harness.invoice(TENANT_A, invoice(2, { status: 'cancelled' }));
      await harness.invoice(TENANT_A, invoice(3, { customerId: OMEGA }));
      await harness.invoice(TENANT_B, invoice(4, { customerId: FOREIGN_CUSTOMER, lines: [{ itemId: FOREIGN_ITEM, subtotal: 10 }] }));
      await harness.payment(TENANT_A, { code: 'COB900001', customerId: DELTA, date: '2026-03-06', status: 'confirmed', allocations: [{ invoiceId: invoiceId(1), amount: 30.1 }] });
      await harness.payment(TENANT_A, { code: 'COB900002', customerId: DELTA, date: '2026-03-07', status: 'confirmed', allocations: [{ invoiceId: invoiceId(1), amount: 0.2 }] });
      await harness.payment(TENANT_A, { code: 'COB900003', customerId: DELTA, date: '2026-03-07', status: 'cancelled', allocations: [{ invoiceId: invoiceId(1), amount: 50 }] });
      await harness.payment(TENANT_A, { code: 'COB900004', customerId: DELTA, date: '2026-03-07', status: 'draft', allocations: [{ invoiceId: invoiceId(1), amount: 20 }] });
      const readModel = harness.readModel();

      expect(await readModel.issuedInvoices(tenant, 2, DELTA)).toEqual([
        { id: invoiceId(1), code: 'FAC900001', customerId: DELTA, issueDate: '2026-03-05', dueDate: '2026-03-20', total: 100, paid: 30.3, balance: 69.7 },
      ]);
      expect((await readModel.issuedInvoices(tenant, 2)).map((row) => row.code)).toEqual(['FAC900001', 'FAC900003']);
      expect(await readModel.issuedInvoices(TenantId.of(TENANT_B), 2, DELTA)).toEqual([]);
    });

    it('builds the statement from issued invoices and confirmed payments only', async () => {
      await harness.invoice(TENANT_A, invoice(1));
      await harness.invoice(TENANT_A, invoice(2, { status: 'cancelled' }));
      await harness.payment(TENANT_A, { code: 'COB900001', customerId: DELTA, date: '2026-03-06', status: 'confirmed', allocations: [{ invoiceId: invoiceId(1), amount: 5 }] });
      await harness.payment(TENANT_A, { code: 'COB900002', customerId: DELTA, date: '2026-03-06', status: 'draft', allocations: [{ invoiceId: invoiceId(1), amount: 1 }] });

      const entries = await harness.readModel().statementEntries(tenant, DELTA, 2);

      expect([...entries].sort((a, b) => a.code.localeCompare(b.code))).toEqual([
        { date: '2026-03-06', type: 'payment', code: 'COB900001', amount: 5 },
        { date: '2026-03-05', type: 'invoice', code: 'FAC900001', amount: 11.6 },
      ]);
    });

    it('adds up a period with both ends included: sales, purchases rounded per line and collections', async () => {
      await harness.invoice(TENANT_A, invoice(1, { issueDate: '2026-03-01' }));
      await harness.invoice(TENANT_A, invoice(2, { issueDate: '2026-03-31', dueDate: '2026-03-31', total: 0.2 }));
      await harness.invoice(TENANT_A, invoice(3, { issueDate: '2026-04-01', dueDate: '2026-04-01', total: 999 }));
      await harness.invoice(TENANT_A, invoice(4, { issueDate: '2026-03-10', status: 'cancelled', total: 999 }));
      await harness.payment(TENANT_A, { code: 'COB900001', customerId: DELTA, date: '2026-03-31', status: 'confirmed', allocations: [{ invoiceId: invoiceId(1), amount: 1.1 }] });
      await harness.payment(TENANT_A, { code: 'COB900002', customerId: DELTA, date: '2026-02-28', status: 'confirmed', allocations: [{ invoiceId: invoiceId(1), amount: 5 }] });
      // 3 unidades a 0,333333: 0,999999 redondea a 1,00 por linea.
      await harness.receipt(TENANT_A, { date: '2026-03-15', status: 'confirmed', warehouseId: MAIN, lines: [{ itemId: WATER, quantity: 3, unitCost: 0.333333 }, { itemId: SOAP, quantity: 2.5, unitCost: 4 }] });
      await harness.receipt(TENANT_A, { date: '2026-03-15', status: 'draft', warehouseId: MAIN, lines: [{ itemId: WATER, quantity: 100, unitCost: 1 }] });
      const readModel = harness.readModel();

      expect(await readModel.salesTotal(tenant, march, 2)).toBe(11.8);
      expect(await readModel.purchasesTotal(tenant, march, 2)).toBe(11);
      expect(await readModel.collectedTotal(tenant, march, 2)).toBe(1.1);
      expect(await readModel.salesTotal(TenantId.of(TENANT_B), march, 2)).toBe(0);
    });

    it('groups sales by customer and by item', async () => {
      await harness.invoice(TENANT_A, invoice(1, { subtotal: 10, tax: 1.6, total: 11.6, lines: [{ itemId: WATER, subtotal: 6 }, { itemId: SOAP, subtotal: 4 }] }));
      await harness.invoice(TENANT_A, invoice(2, { subtotal: 20.05, tax: 0, total: 20.05, lines: [{ itemId: WATER, subtotal: 20.05 }] }));
      await harness.invoice(TENANT_A, invoice(3, { customerId: OMEGA, subtotal: 1, tax: 0, total: 1, lines: [{ itemId: SOAP, subtotal: 1 }] }));
      const readModel = harness.readModel();

      expect((await readModel.salesByCustomer(tenant, march, 2)).sort((a, b) => a.total - b.total)).toEqual([
        { customerId: OMEGA, invoices: 1, subtotal: 1, tax: 0, total: 1 },
        { customerId: DELTA, invoices: 2, subtotal: 30.05, tax: 1.6, total: 31.65 },
      ]);
      expect((await readModel.salesByItem(tenant, march, 2)).sort((a, b) => a.sku.localeCompare(b.sku))).toEqual([
        { itemId: WATER, sku: 'REPORTE-AGUA', name: 'Reporte agua', subtotal: 26.05 },
        { itemId: SOAP, sku: 'REPORTE-JABON', name: 'Reporte jabón', subtotal: 5 },
      ]);
    });

// Lo que suma un reporte va en la moneda de la empresa: cada documento se convierte con las dos
    // tasas que congelo. Euro a 40 y dolar a 36,50: 100 EUR son 109,59 USD.
    it('converts every document to the company currency with the rates it froze', async () => {
      const euros = { currency: 'EUR', exchangeRate: 40, baseCurrency: 'USD', baseExchangeRate: 36.5 };

      await harness.invoice(TENANT_A, invoice(1, { subtotal: 100, tax: 0, total: 100, lines: [{ itemId: WATER, subtotal: 100 }], ...euros }));
      await harness.payment(TENANT_A, {
        code: 'COB900001',
        customerId: DELTA,
        date: '2026-03-06',
        status: 'confirmed',
        currency: 'VES',
        exchangeRate: 1,
        baseCurrency: 'USD',
        baseExchangeRate: 36.5,
        amount: 4000,
        allocations: [{ invoiceId: invoiceId(1), amount: 100 }],
      });
      await harness.receipt(TENANT_A, { date: '2026-03-15', status: 'confirmed', warehouseId: MAIN, lines: [{ itemId: WATER, quantity: 2, unitCost: 50 }], ...euros });
      const readModel = harness.readModel();

      expect(await readModel.issuedInvoices(tenant, 2, DELTA)).toEqual([
        { id: invoiceId(1), code: 'FAC900001', customerId: DELTA, issueDate: '2026-03-05', dueDate: '2026-03-20', total: 109.59, paid: 109.59, balance: 0 },
      ]);
      expect(await readModel.salesTotal(tenant, march, 2)).toBe(109.59);
      // 100 EUR de la factura, cobrados con 4000 Bs: el cobro vale lo mismo en la moneda de la empresa.
      expect(await readModel.collectedTotal(tenant, march, 2)).toBe(109.59);
      expect(await readModel.purchasesTotal(tenant, march, 2)).toBe(109.59);
      expect(await readModel.salesByCustomer(tenant, march, 2)).toEqual([{ customerId: DELTA, invoices: 1, subtotal: 109.59, tax: 0, total: 109.59 }]);
      expect((await readModel.salesByItem(tenant, march, 2)).map((row) => row.subtotal)).toEqual([109.59]);
      expect(await readModel.statementEntries(tenant, DELTA, 2)).toEqual(
        expect.arrayContaining([
          { date: '2026-03-05', type: 'invoice', code: 'FAC900001', amount: 109.59 },
          { date: '2026-03-06', type: 'payment', code: 'COB900001', amount: 109.59 },
        ]),
      );
    });

        it('reads the stock that is not zero, with its base unit, per warehouse and never across companies', async () => {
      await harness.stock(TENANT_A, { itemId: WATER, warehouseId: MAIN, quantity: 288, averageCost: 0.5 });
      await harness.stock(TENANT_A, { itemId: SOAP, warehouseId: NORTH, quantity: 2.5, averageCost: 3.333333 });
      await harness.stock(TENANT_A, { itemId: SOAP, warehouseId: MAIN, quantity: 0, averageCost: 9 });
      await harness.stock(TENANT_B, { itemId: FOREIGN_ITEM, warehouseId: FOREIGN_WAREHOUSE, quantity: 5, averageCost: 1 });
      const readModel = harness.readModel();

      expect((await readModel.stock(tenant)).sort((a, b) => a.sku.localeCompare(b.sku))).toEqual([
        { warehouseId: MAIN, warehouseName: 'Reporte principal', itemId: WATER, sku: 'REPORTE-AGUA', name: 'Reporte agua', baseUnit: 'rcu', quantity: 288, averageCost: 0.5 },
        { warehouseId: NORTH, warehouseName: 'Reporte norte', itemId: SOAP, sku: 'REPORTE-JABON', name: 'Reporte jabón', baseUnit: 'rck', quantity: 2.5, averageCost: 3.333333 },
      ]);
      expect((await readModel.stock(tenant, NORTH)).map((row) => row.sku)).toEqual(['REPORTE-JABON']);
      // El nombre, no un si o un no: el PDF de una bodega vacia lo necesita, y sin filas de
      // existencia no hay de donde sacarlo.
      expect(await readModel.warehouseNamed(tenant, NORTH)).toBe('Reporte norte');
      expect(await readModel.warehouseNamed(tenant, FOREIGN_WAREHOUSE)).toBe(null);
      // En mayusculas es el mismo identificador. PostgreSQL ya lo trataba asi y el doble no.
      expect(await readModel.warehouseNamed(tenant, NORTH.toUpperCase())).toBe('Reporte norte');
    });
  });
}
