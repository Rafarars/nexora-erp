import { expect, test } from '@playwright/test';
import { auth, companyToday, tokenFor } from '../../support/inventory-fixtures.js';
import { aCreditCustomer, anInvoice } from '../../support/receivables-fixtures.js';
import { ACME_INVENTORY } from '../../support/inventory-fixtures.js';
import { DISPATCHES, INVOICES, SALES_ORDERS, aDraftDispatch, aDraftSalesOrder, aFreshCustomer, aStockedItem } from '../../support/sales-fixtures.js';
import { excelRows, pdfText } from '../../support/report-files.js';
import { aConfirmedPurchaseInvoice, aFreshSupplier } from '../../support/purchasing-fixtures.js';

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
    const today = companyToday();

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
    const today = companyToday();
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

  // El nombre de la bodega salia de la primera fila del reporte. Una bodega vacia no tiene filas,
  // asi que el PDF decia "Todas las bodegas" con el total en cero: un papel que niega el inventario
  // de toda la empresa cuando solo se pregunto por una bodega.
  test('the valuation PDF of an empty warehouse names that warehouse, not all of them', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const name = `Vacia ${Date.now()}`;
    const created = await request.post('/api/v1/catalog/warehouses', { headers: auth(token), data: { code: `VAC${Date.now() % 100000}`, name } });

    expect(created.status()).toBe(201);

    const list = await (await request.get('/api/v1/catalog/warehouses?limit=200', { headers: auth(token) })).json();
    const warehouse = list.warehouses.find((row: { name: string }) => row.name === name);

    const report = await (await request.get(`${REPORTS}/inventory-valuation?warehouseId=${warehouse.id}`, { headers: auth(token) })).json();
    expect([report.rows.length, report.warehouseName]).toEqual([0, name]);

    const text = await pdfText(await (await request.get(`${REPORTS}/inventory-valuation/export?warehouseId=${warehouse.id}&format=pdf`, { headers: auth(token) })).body());

    expect(text).toContain(`Bodega ${name}`);
    expect(text).not.toContain('Todas las bodegas');
  });

  test('refuses an unknown format and a period longer than a year, in the error contract', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');

    const format = await request.get(`${REPORTS}/receivables-aging/export?format=docx`, { headers: auth(token) });
    expect([format.status(), (await format.json()).error]).toEqual([400, 'InvalidExportFormatError']);

    const period = await request.get(`${REPORTS}/sales-by-customer?from=2024-01-01&to=2026-01-01`, { headers: auth(token) });
    expect([period.status(), (await period.json()).error]).toEqual([400, 'ReportPeriodTooLongError']);
  });

  test('the payables aging Excel and PDF hold the same figures as the screen', async ({ request }) => {
    const token = await tokenFor(request, 'beto@globex.com');

    const xlsxRes = await request.get(`${REPORTS}/payables-aging/export?format=xlsx`, { headers: auth(token) });
    expect(xlsxRes.headers()['content-type']).toContain('spreadsheetml');
    expect(xlsxRes.headers()['content-disposition']).toMatch(/antiguedad-de-saldos-por-pagar-\d{4}-\d{2}-\d{2}\.xlsx/);

    const rows = await excelRows(await xlsxRes.body());
    expect(rows[0]).toEqual(['Antigüedad de saldos por pagar']);
    expect(rows[1]).toEqual(['Globex Servicios, C.A. · RIF J-40000002-0']);
    expect(rows.find((row) => row[1] === 'Repuestos Industriales')?.at(-1)).toBe(96);
    expect(rows.at(-1)?.[0]).toBe('Total');
    expect(rows.at(-1)?.at(-1)).toBe(96);

    const pdfRes = await request.get(`${REPORTS}/payables-aging/export?format=pdf`, { headers: auth(token) });
    expect(pdfRes.headers()['content-type']).toBe('application/pdf');

    const text = await pdfText(await pdfRes.body());
    expect(text).toContain('Antigüedad de saldos por pagar');
    expect(text).toContain('Globex Servicios, C.A.');
    expect(text).toMatch(/Repuestos\s+Industriales/);
    expect(text).toContain('96,00');
  });
});

test.describe('payables cross-check', () => {
  // Se ejecuta en Wayne ('bruce@wayne.com'), un tenant dedicado donde ninguna otra prueba escribe
  // en paralelo, eliminando data races en las comprobaciones globales del tablero y asegurando
  // que la suma de facturas y proveedores sea exacta y determinista.
  test('§3.8 the invoice list, supplier aging, reports aging, statement and dashboard report the exact same balance', async ({ request }) => {
    const token = await tokenFor(request, 'bruce@wayne.com');
    const supplier = await aFreshSupplier(request, token);
    const today = companyToday();

    const inv1 = await aConfirmedPurchaseInvoice(request, token, supplier.id, 150, today);
    const inv2 = await aConfirmedPurchaseInvoice(request, token, supplier.id, 250, today);

    const payRes = await request.post('/api/v1/payables/payments', {
      headers: auth(token),
      data: {
        supplierId: supplier.id,
        date: today,
        method: 'transfer',
        reference: `TRF-${Date.now()}`,
        currency: 'USD',
        allocations: [{ invoiceId: inv1.id, amount: 70 }],
      },
    });
    expect(payRes.status()).toBe(201);
    const payment = await payRes.json();
    const confirmPayRes = await request.put(`/api/v1/payables/payments/${payment.id}/confirm`, {
      headers: auth(token),
    });
    expect(confirmPayRes.status()).toBe(200);

    // 1. Listado de facturas: filtrado expresamente por el proveedor (nunca paginar a ciegas)
    const invListRes = await request.get(`/api/v1/payables/invoices?supplierId=${supplier.id}`, { headers: auth(token) });
    expect(invListRes.status()).toBe(200);
    const { invoices: supplierInvoices } = await invListRes.json();
    const supplierInvoicesBalance = supplierInvoices
      .filter((i: { status: string }) => i.status !== 'paid')
      .reduce((sum: number, i: { companyBalance: number }) => Math.round((sum + i.companyBalance) * 100) / 100, 0);

    expect(supplierInvoicesBalance).toBe(330);

    // 2. Antigüedad de Cuentas por pagar: filtrado por el proveedor
    const payablesSuppliersRes = await request.get(`/api/v1/payables/suppliers?q=${encodeURIComponent(supplier.name)}`, { headers: auth(token) });
    expect(payablesSuppliersRes.status()).toBe(200);
    const payablesSuppliersData = await payablesSuppliersRes.json();
    const payablesSupplierRow = payablesSuppliersData.suppliers.find((s: { supplier: { id: string } }) => s.supplier.id === supplier.id);
    expect(payablesSupplierRow).toBeDefined();
    expect(payablesSupplierRow.balance).toBe(330);
    expect(payablesSupplierRow.aging.total).toBe(330);

    // 3. Antigüedad en Reportes
    const reportsAgingRes = await request.get(`${REPORTS}/payables-aging?limit=50`, { headers: auth(token) });
    expect(reportsAgingRes.status()).toBe(200);
    const reportsAgingData = await reportsAgingRes.json();
    const reportsSupplierRow = reportsAgingData.suppliers.find((s: { supplier: { id: string } }) => s.supplier.id === supplier.id);
    expect(reportsSupplierRow).toBeDefined();
    expect(reportsSupplierRow.aging.total).toBe(330);

    // 4. Estado de cuenta del proveedor
    const statementRes = await request.get(`/api/v1/payables/suppliers/${supplier.id}/statement`, { headers: auth(token) });
    expect(statementRes.status()).toBe(200);
    const statementData = await statementRes.json();
    expect(statementData.summary.balance).toBe(330);
    const lastMovement = statementData.movements.at(-1);
    expect(lastMovement?.balance).toBe(330);

    // Coincidencia exacta del saldo del proveedor en las 4 fuentes
    expect(supplierInvoicesBalance).toBe(payablesSupplierRow.balance);
    expect(payablesSupplierRow.balance).toBe(reportsSupplierRow.aging.total);
    expect(reportsSupplierRow.aging.total).toBe(statementData.summary.balance);

    // Y a nivel global de la empresa (aislado en Wayne donde nadie escribe en paralelo):
    const [allInvoicesRes, allSuppliersRes, allAgingRes, dashboardRes] = await Promise.all([
      request.get('/api/v1/payables/invoices?limit=50', { headers: auth(token) }),
      request.get('/api/v1/payables/suppliers?limit=50', { headers: auth(token) }),
      request.get(`${REPORTS}/payables-aging?limit=50`, { headers: auth(token) }),
      request.get(`${REPORTS}/dashboard`, { headers: auth(token) }),
    ]);

    expect(allInvoicesRes.status()).toBe(200);
    expect(allSuppliersRes.status()).toBe(200);
    expect(allAgingRes.status()).toBe(200);
    expect(dashboardRes.status()).toBe(200);

    const allInvoicesData = await allInvoicesRes.json();
    const allSuppliersData = await allSuppliersRes.json();
    const allAgingData = await allAgingRes.json();
    const dashboardData = await dashboardRes.json();

    expect(allInvoicesData.hasMore).toBe(false);

    const totalInvoicesBalance = allInvoicesData.invoices
      .filter((i: { status: string }) => i.status !== 'paid')
      .reduce((sum: number, i: { companyBalance: number }) => Math.round((sum + i.companyBalance) * 100) / 100, 0);

    const totalSuppliersBalance = allSuppliersData.totals.total;
    const totalAgingBalance = allAgingData.totals.total;
    const dashboardPayableBalance = dashboardData.payableBalance;

    expect(totalInvoicesBalance).toBe(totalSuppliersBalance);
    expect(totalSuppliersBalance).toBe(totalAgingBalance);
    expect(totalAgingBalance).toBe(dashboardPayableBalance);
    expect(dashboardPayableBalance).toBe(330);
  });
});
