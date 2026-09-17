import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { ReceivablesPage } from '../../pages/receivables.page.js';
import { SalesPage } from '../../pages/sales.page.js';
import { tokenFor } from '../../support/inventory-fixtures.js';
import { aConfirmedDispatch, aCreditCustomer, anInvoice } from '../../support/receivables-fixtures.js';

const API = process.env.API_URL ?? 'http://localhost:3001';

// Cobrar una factura desde la pantalla, en pasos Dado, Cuando y Entonces. La factura se emite por
// API con cliente y articulo propios: la prueba es sobre la cobranza.
test('collects part of an invoice from the screen and cancelling the payment gives the balance back', async ({ page, request }) => {
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const customer = await aCreditCustomer(request, token, { paymentTermDays: 15, creditLimit: 500 }, API);
  const invoice = await anInvoice(request, token, customer.id, 100, undefined, API);
  const receivables = new ReceivablesPage(page);

  await test.step('Dado que la administradora de Acme inició sesión y el cliente debe una factura de 100', async () => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    await receivables.open('facturas');
    await expect(page.getByTestId(`receivable-balance-${invoice.code}`)).toHaveText('100,00');
    await expect(page.getByTestId(`receivable-status-${invoice.code}`)).toHaveText('Pendiente');
  });

  await test.step('Cuando registra un cobro de 40 y lo confirma', async () => {
    await receivables.open('cobros');
    await receivables.startPayment(customer.name, [{ invoice: invoice.code, amount: '40' }], 'TRF-UI');
    await expect(page.getByTestId('payment-panel')).toBeHidden();
    await expect(receivables.paymentOf(customer.name).getByTestId(/payment-status-/)).toHaveText('Borrador');
    await receivables.act(receivables.paymentOf(customer.name), 'Confirmar');
    await expect(receivables.paymentOf(customer.name).getByTestId(/payment-status-/)).toHaveText('Confirmado');
  });

  await test.step('Entonces la factura debe 60, el cliente tiene 440 de crédito y el estado de cuenta lo cuadra', async () => {
    await receivables.open('facturas');
    await expect(page.getByTestId(`receivable-balance-${invoice.code}`)).toHaveText('60,00');
    await expect(page.getByTestId(`receivable-status-${invoice.code}`)).toHaveText('Cobrada en parte');
    await receivables.open('antiguedad');
    await expect(page.getByTestId(`aging-balance-${customer.code}`)).toHaveText('60,00');
    await expect(page.getByTestId(`aging-credit-${customer.code}`)).toContainText('Disponible 440,00');
    await receivables.open('estado-de-cuenta');
    await receivables.showStatementOf(customer.name);
    await expect(page.getByTestId('statement-balance-2')).toHaveText('60,00');
    await expect(page.getByTestId('statement-balance')).toHaveText('60,00');
  });

  await test.step('Cuando anula el cobro', async () => {
    await receivables.open('cobros');
    await receivables.act(receivables.paymentOf(customer.name), 'Anular');
    await expect(receivables.paymentOf(customer.name).getByTestId(/payment-status-/)).toHaveText('Anulado');
  });

  await test.step('Entonces la factura vuelve a deber 100', async () => {
    await receivables.open('facturas');
    await expect(page.getByTestId(`receivable-balance-${invoice.code}`)).toHaveText('100,00');
    await expect(page.getByTestId(`receivable-status-${invoice.code}`)).toHaveText('Pendiente');
  });
});

// Cobrar en bolivares una factura en dolares: el cobro dice cuanto entro en bolivares y el diferencial
// cambiario queda a la vista en el cobro y en el estado de cuenta.
test('collects a dollar invoice in bolivars from the screen and shows the exchange difference', async ({ page, request }) => {
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const customer = await aCreditCustomer(request, token, { paymentTermDays: 15, creditLimit: null }, API);
  const invoice = await anInvoice(request, token, customer.id, 100, '2026-09-10', API);
  const receivables = new ReceivablesPage(page);

  await new LoginPage(page).signIn(ACME_ADMIN);
  await receivables.open('cobros');
  await page.getByTestId('new-payment').click();
  await page.getByTestId('payment-customer').selectOption({ label: customer.name });
  await page.getByTestId('payment-currency').selectOption('VES');
  await page.getByTestId('payment-reference').fill('TRF-BS');
  await page.getByTestId(`payment-allocation-${invoice.code}`).fill('40');
  await page.getByTestId('payment-submit').click();
  await expect(page.getByTestId('payment-panel')).toBeHidden();

  const row = receivables.paymentOf(customer.name);
  await receivables.act(row, 'Confirmar');
  await expect(row.getByTestId(/payment-status-/)).toHaveText('Confirmado');
  await expect(row.getByTestId(/payment-amount-/)).toHaveText('VES 6124,00');
  await expect(row.getByTestId(/payment-difference-/)).toHaveText('Diferencial Bs. 28,00');

  await receivables.open('estado-de-cuenta');
  await receivables.showStatementOf(customer.name);
  await expect(page.getByTestId('statement-difference-2')).toHaveText('28,00');
  await expect(page.getByTestId('statement-balance')).toHaveText('60,00');
});

test('explains in Spanish that a payment cannot take more than the invoice owes', async ({ page, request }) => {
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const customer = await aCreditCustomer(request, token, {}, API);
  const invoice = await anInvoice(request, token, customer.id, 30, undefined, API);
  const receivables = new ReceivablesPage(page);

  await new LoginPage(page).signIn(ACME_ADMIN);
  await receivables.open('cobros');
  await receivables.startPayment(customer.name, [{ invoice: invoice.code, amount: '30,01' }], 'TRF-DE-MAS');

  await expect(page.getByTestId('payment-error')).toHaveText('El cobro aplica a una factura más de lo que debe.');
});

test('refuses from the screen to invoice on credit a customer with an overdue invoice', async ({ page, request }) => {
  const token = await tokenFor(request, ACME_ADMIN.email, API);
  const customer = await aCreditCustomer(request, token, { paymentTermDays: 15 }, API);
  await anInvoice(request, token, customer.id, 20, '2026-01-15', API);
  const dispatch = await aConfirmedDispatch(request, token, customer.id, 10, 10, API);
  const sales = new SalesPage(page);

  await new LoginPage(page).signIn(ACME_ADMIN);
  await sales.open('despachos');
  await sales.act(sales.dispatchWith(dispatch.code), 'Facturar');

  await expect(page.getByTestId('dispatch-action-error')).toHaveText('El cliente tiene facturas vencidas: no se le puede facturar a crédito hasta que pague.');
});

test('a read-only role sees payments, balances and aging but gets no way to collect', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  const receivables = new ReceivablesPage(page);

  await receivables.open('cobros');
  await expect(page.getByTestId('payment-status-COB000001')).toHaveText('Confirmado');
  await expect(page.getByTestId('new-payment')).toHaveCount(0);
  await expect(page.getByTestId('payment-options-COB000001')).toHaveCount(0);

  await receivables.open('facturas');
  await expect(page.getByTestId('receivable-balance-FAC000001')).toHaveText('39,60');
  await expect(page.getByTestId('receivable-status-FAC000001')).toHaveText('Cobrada en parte');

  await receivables.open('antiguedad');
  await expect(page.getByTestId('aging-balance-CLI000001')).toHaveText('39,60');
  await expect(page.getByTestId('aging-credit-CLI000001')).toContainText('Disponible 960,40');
});
