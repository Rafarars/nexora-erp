import { expect, test } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { auth, tokenFor } from '../../support/inventory-fixtures.js';
import { BALANCES, PAYMENTS, RECEIVABLES, aConfirmedDispatch, aCreditCustomer, aDraftPayment, anInvoice, issue } from '../../support/receivables-fixtures.js';
import { INVOICES } from '../../support/sales-fixtures.js';

const put = (request: APIRequestContext, token: string, path: string) => request.put(path, { headers: auth(token) });

async function receivable(request: APIRequestContext, token: string, invoiceId: string) {
  const { receivables } = await (await request.get(RECEIVABLES, { headers: auth(token) })).json();

  return receivables.find((row: { id: string }) => row.id === invoiceId);
}

const error = async (response: APIResponse) => [response.status(), (await response.json()).error];

test.describe('payments', () => {
  // La prueba que pide el plan: anular un cobro revierte el saldo.
  test('a confirmed payment lowers the balance and cancelling it gives the balance back', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token);
    const invoice = await anInvoice(request, token, customer.id, 100);
    const payment = await aDraftPayment(request, token, customer.id, [{ invoiceId: invoice.id, amount: 40 }]);

    expect(payment).toMatchObject({ code: expect.stringMatching(/^COB\d{6}$/), amount: 40 });
    expect(await receivable(request, token, invoice.id)).toMatchObject({ balance: 100, status: 'pending' });

    expect((await put(request, token, `${PAYMENTS}/${payment.id}/confirm`)).status()).toBe(200);
    expect(await receivable(request, token, invoice.id)).toMatchObject({ paid: 40, balance: 60, status: 'partially_paid' });

    expect((await put(request, token, `${PAYMENTS}/${payment.id}/cancel`)).status()).toBe(200);
    expect(await receivable(request, token, invoice.id)).toMatchObject({ paid: 0, balance: 100, status: 'pending' });
  });

  test('refuses to apply more than the invoice owes', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token);
    const invoice = await anInvoice(request, token, customer.id, 50);

    const response = await request.post(PAYMENTS, { headers: auth(token), data: { customerId: customer.id, method: 'cash', allocations: [{ invoiceId: invoice.id, amount: 50.01 }] } });

    expect(await error(response)).toEqual([409, 'PaymentExceedsBalanceError']);
  });

  test('lets only one of two simultaneous payments through when both do not fit the invoice', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token);
    const invoice = await anInvoice(request, token, customer.id, 100);
    const [first, second] = [
      await aDraftPayment(request, token, customer.id, [{ invoiceId: invoice.id, amount: 70 }]),
      await aDraftPayment(request, token, customer.id, [{ invoiceId: invoice.id, amount: 70 }]),
    ];

    const responses = await Promise.all([put(request, token, `${PAYMENTS}/${first.id}/confirm`), put(request, token, `${PAYMENTS}/${second.id}/confirm`)]);

    expect(responses.map((r) => r.status()).sort()).toEqual([200, 409]);
    expect(await receivable(request, token, invoice.id)).toMatchObject({ paid: 70, balance: 30 });
  });

  test('an invoice with payments cannot be cancelled until the payment is', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token);
    const invoice = await anInvoice(request, token, customer.id, 30);
    const payment = await aDraftPayment(request, token, customer.id, [{ invoiceId: invoice.id, amount: 30 }]);
    await put(request, token, `${PAYMENTS}/${payment.id}/confirm`);

    expect(await error(await put(request, token, `${INVOICES}/${invoice.id}/cancel`))).toEqual([409, 'InvoiceWithPaymentsError']);

    await put(request, token, `${PAYMENTS}/${payment.id}/cancel`);
    expect((await put(request, token, `${INVOICES}/${invoice.id}/cancel`)).status()).toBe(200);
  });
});

test.describe('credit', () => {
  // La segunda prueba del plan: con vencidas no se factura a credito.
  test('a customer with an overdue invoice cannot be invoiced on credit until it pays', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token, { paymentTermDays: 15 });
    // Emitida en enero: vencio hace mas de 90 dias.
    const overdue = await anInvoice(request, token, customer.id, 20, '2026-01-15');
    const dispatch = await aConfirmedDispatch(request, token, customer.id);

    expect(await error(await issue(request, token, dispatch.id))).toEqual([409, 'CustomerWithOverdueInvoicesError']);

    const { customers } = await (await request.get(BALANCES, { headers: auth(token) })).json();
    expect(customers.find((row: { customer: { id: string } }) => row.customer.id === customer.id)).toMatchObject({ balance: 20, overdue: 20, creditBlocked: true, aging: { over90: 20 } });

    const payment = await aDraftPayment(request, token, customer.id, [{ invoiceId: overdue.id, amount: 20 }]);
    await put(request, token, `${PAYMENTS}/${payment.id}/confirm`);

    expect((await issue(request, token, dispatch.id)).status()).toBe(201);
  });

  test('a cash customer is invoiced even with overdue invoices', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token, { paymentTermDays: 0, creditLimit: 0 });
    const dispatch = await aConfirmedDispatch(request, token, customer.id);

    expect((await issue(request, token, dispatch.id)).status()).toBe(201);
  });

  test('the credit limit stops the invoice that would go over it, also when two arrive at once', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token, { creditLimit: 150 });
    await anInvoice(request, token, customer.id, 100);
    const [first, second] = [await aConfirmedDispatch(request, token, customer.id, 10, 4), await aConfirmedDispatch(request, token, customer.id, 10, 4)];

    const responses = await Promise.all([issue(request, token, first.id), issue(request, token, second.id)]);

    expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);

    const { customers } = await (await request.get(BALANCES, { headers: auth(token) })).json();
    expect(customers.find((row: { customer: { id: string } }) => row.customer.id === customer.id)).toMatchObject({ balance: 140, availableCredit: 10 });
  });
});

test.describe('statement', () => {
  // La tercera prueba del plan: los cobros cuadran con el saldo.
  test('the statement ends at what the invoices still owe', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token);
    const [a, b] = [await anInvoice(request, token, customer.id, 100), await anInvoice(request, token, customer.id, 55.5)];
    const kept = await aDraftPayment(request, token, customer.id, [{ invoiceId: a.id, amount: 30.25 }, { invoiceId: b.id, amount: 55.5 }]);
    const undone = await aDraftPayment(request, token, customer.id, [{ invoiceId: a.id, amount: 10 }]);
    await put(request, token, `${PAYMENTS}/${kept.id}/confirm`);
    await put(request, token, `${PAYMENTS}/${undone.id}/confirm`);
    await put(request, token, `${PAYMENTS}/${undone.id}/cancel`);

    const { summary, movements } = await (await request.get(`${BALANCES}/${customer.id}/statement`, { headers: auth(token) })).json();
    const { receivables } = await (await request.get(`${RECEIVABLES}?customerId=${customer.id}`, { headers: auth(token) })).json();
    const owed = receivables.reduce((sum: number, row: { balance: number }) => sum + Math.round(row.balance * 100), 0) / 100;

    expect(movements.map((row: { type: string; debit: number; credit: number }) => [row.type, row.debit, row.credit])).toEqual([
      ['invoice', 100, 0],
      ['invoice', 55.5, 0],
      ['payment', 0, 85.75],
    ]);
    expect([movements.at(-1).balance, summary.balance, owed]).toEqual([69.75, 69.75, 69.75]);
  });
});

// Lo normal en Venezuela: una factura en dolares que el cliente paga en bolivares a la tasa del dia.
// Tasas legales sembradas de Acme: el dolar a 152,40 desde el 8 de septiembre y a 153,10 desde el 11.
test.describe('currency and exchange rates of collections', () => {
  test('a dollar invoice collected in bolivars lowers the debt in dollars and keeps the exchange difference', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token);
    const invoice = await anInvoice(request, token, customer.id, 100, '2026-09-10');
    const { invoices } = await (await request.get(INVOICES, { headers: auth(token) })).json();

    expect(invoices.find((row: { id: string }) => row.id === invoice.id)).toMatchObject({ currency: 'USD', exchangeRate: 152.4, total: 100, totalVes: 15240 });

    const reference = `e2e bolivares ${Date.now()}`;
    const created = await request.post(PAYMENTS, {
      headers: auth(token),
      data: { customerId: customer.id, method: 'transfer', reference, currency: 'VES', allocations: [{ invoiceId: invoice.id, amount: 40 }] },
    });
    expect(created.status(), await created.text()).toBe(201);

    const paymentOf = async () => (await (await request.get(PAYMENTS, { headers: auth(token) })).json()).payments.find((row: { reference: string }) => row.reference === reference);
    expect((await put(request, token, `${PAYMENTS}/${(await paymentOf()).id}/confirm`)).status()).toBe(200);

    // 40 USD a 153,10 son 6124 Bs; facturados a 152,40 valian 6096: el diferencial es 28 Bs.
    expect(await paymentOf()).toMatchObject({
      status: 'confirmed',
      currency: 'VES',
      amount: 6124,
      amountVes: 6124,
      allocations: [{ invoiceId: invoice.id, currency: 'USD', amount: 40, exchangeRate: 153.1, exchangeDifference: 28 }],
    });
    expect(await receivable(request, token, invoice.id)).toMatchObject({ currency: 'USD', paid: 40, balance: 60 });
  });

  test('refuses a written rate for the company currency', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const customer = await aCreditCustomer(request, token);
    const invoice = await anInvoice(request, token, customer.id, 50);

    expect(
      await error(await request.post(PAYMENTS, { headers: auth(token), data: { customerId: customer.id, method: 'cash', currency: 'USD', exchangeRate: 150, allocations: [{ invoiceId: invoice.id, amount: 10 }] } })),
    ).toEqual([400, 'FixedExchangeRateError']);
  });
});
