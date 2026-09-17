import { expect, test } from '@playwright/test';
import { auth, tokenFor } from '../../support/inventory-fixtures.js';
import { aCreditCustomer, anInvoice } from '../../support/receivables-fixtures.js';
import { ACME_INVENTORY } from '../../support/inventory-fixtures.js';
import { DISPATCHES, INVOICES, SALES_ORDERS, aDraftDispatch, aDraftSalesOrder, aFreshCustomer, aStockedItem } from '../../support/sales-fixtures.js';
import { excelRows, pdfText } from '../../support/report-files.js';

const REPORTS = '/api/v1/reports';
const DELTA = 'ed000000-0000-4000-8000-000000000001';

// Los reportes de Globex salen de datos que ninguna prueba toca (la matriz de aislamiento solo
// comprueba que nada cambie): sus cifras se pueden afirmar exactas en paralelo.
test.describe('dashboard', () => {
  test('adds up what is owed today and what the stock is worth', async ({ request }) => {
    const token = await tokenFor(request, 'beto@globex.com');
    const response = await request.get(`${REPORTS}/dashboard`, { headers: auth(token) });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      receivableBalance: 61.2,
      inventoryValue: 212.5,
      topDebtors: [{ customer: { name: 'Talleres Omega' }, balance: 61.2 }],
    });
  });

  test('a read-only role sees the dashboard but not the stock at cost', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');

    expect((await request.get(`${REPORTS}/dashboard`, { headers: auth(token) })).status()).toBe(200);
    expect((await request.get(`${REPORTS}/inventory-valuation`, { headers: auth(token) })).status()).toBe(403);
  });
});

test.describe('exports', () => {
  test('the aging Excel holds the same figures as the screen, as numbers', async ({ request }) => {
    const token = await tokenFor(request, 'beto@globex.com');
    const response = await request.get(`${REPORTS}/receivables-aging/export?format=xlsx`, { headers: auth(token) });

    expect(response.headers()['content-type']).toContain('spreadsheetml');
    expect(response.headers()['content-disposition']).toMatch(/antiguedad-de-saldos-\d{4}-\d{2}-\d{2}\.xlsx/);

    const rows = await excelRows(await response.body());
    expect(rows[0]).toEqual(['Antigüedad de saldos por cobrar']);
    // Quien emite: su razon social y su RIF, de los datos de la empresa.
    expect(rows[1]).toEqual(['Globex Servicios, C.A. · RIF J-40000002-0']);
    expect(rows.find((row) => row[1] === 'Talleres Omega')?.at(-1)).toBe(61.2);
    expect(rows.at(-1)?.[0]).toBe('Total');
  });

  test('the statement PDF shows the invoice, the payment and what is still owed', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const response = await request.get(`${REPORTS}/customers/${DELTA}/statement/export?format=pdf`, { headers: auth(token) });

    expect(response.headers()['content-type']).toBe('application/pdf');

    const text = await pdfText(await response.body());
    expect(text).toContain('Estado de cuenta — Comercial Delta');
    expect(text).toContain('Acme Industrial');
    expect(text).toContain('Factura FAC000001');
    expect(text).toContain('Cobro COB000001');
    expect(text).toContain('39,60');
  });

  test('the sales Excel counts a fresh invoice in today', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token, { paymentTermDays: 0 });
    await anInvoice(request, token, customer.id, 123.45);
    const today = new Date().toISOString().slice(0, 10);

    const rows = await excelRows(await (await request.get(`${REPORTS}/sales-by-customer/export?format=xlsx&from=${today}&to=${today}`, { headers: auth(token) })).body());

    expect(rows.find((row) => row[1] === customer.name)).toEqual([customer.code, customer.name, 1, 123.45, 0, 123.45]);
  });

  // Euro a 175,05 y dolar a 153,10: lo facturado en euros suma en dolares, que es como lleva Acme
  // sus cifras. Sin convertir, el reporte sumaria euros con dolares.
  test('the sales report counts an invoice in euros in the company currency', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const [customer, item] = await Promise.all([aFreshCustomer(request, token), aStockedItem(request, token, 4)]);
    const order = await aDraftSalesOrder(request, token, {
      customerId: customer.id,
      currency: 'EUR',
      lines: [{ itemId: item.id, unitId: ACME_INVENTORY.piece, quantity: 4, unitPrice: 25 }],
    });

    expect((await request.put(`${SALES_ORDERS}/${order.id}/confirm`, { headers: auth(token) })).status()).toBe(200);

    const dispatch = await aDraftDispatch(request, token, order.id, [{ orderLineId: order.lines[0].id, quantity: 4 }]);
    expect((await request.put(`${DISPATCHES}/${dispatch.id}/confirm`, { headers: auth(token) })).status()).toBe(200);
    expect((await request.post(INVOICES, { headers: auth(token), data: { dispatchId: dispatch.id } })).status()).toBe(201);

    const { invoices } = await (await request.get(INVOICES, { headers: auth(token) })).json();
    const invoice = invoices.find((row: { dispatch: { id: string } }) => row.dispatch.id === dispatch.id);
    const today = new Date().toISOString().slice(0, 10);
    const report = await (await request.get(`${REPORTS}/sales-by-customer?from=${today}&to=${today}`, { headers: auth(token) })).json();
    const row = report.customers.find((candidate: { customer: { name: string } }) => candidate.customer.name === customer.name);

    expect(report.currency).toBe('USD');
    expect(invoice).toMatchObject({ currency: 'EUR', exchangeRate: 175.05, baseExchangeRate: 153.1 });
    expect(row.total).toBe(Math.round((invoice.total * 175.05 * 100) / 153.1) / 100);
  });

  test('the valuation PDF values the stock at average cost', async ({ request }) => {
    const token = await tokenFor(request, 'beto@globex.com');
    const text = await pdfText(await (await request.get(`${REPORTS}/inventory-valuation/export?format=pdf`, { headers: auth(token) })).body());

    expect(text).toContain('Valuación del inventario');
    expect(text).toContain('212,50');
  });

  test('refuses an unknown format and a period longer than a year, in the error contract', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    const format = await request.get(`${REPORTS}/receivables-aging/export?format=docx`, { headers: auth(token) });
    expect([format.status(), (await format.json()).error]).toEqual([400, 'InvalidExportFormatError']);

    const period = await request.get(`${REPORTS}/sales-by-customer?from=2024-01-01&to=2026-01-01`, { headers: auth(token) });
    expect([period.status(), (await period.json()).error]).toEqual([400, 'ReportPeriodTooLongError']);
  });
});
