import { describe, expect, it } from 'vitest';
import { InvalidPaymentAmountError } from '../domain/errors/receivables.errors.js';
import { CUSTOMER, DOLLARS, INVOICE, OTHER_INVOICE, TENANT_A } from '../domain/testing/receivables.mother.js';
import { PaymentRequest } from './create-payment/payment-creator.js';
import { ReceivablesScenario, aReceivablesScenario } from './testing/receivables-scenario.js';

const EURO_INVOICE = 'f3333333-3333-4333-8333-333333333333';

// Delta debe 100 USD emitidos a 36,50, 100 EUR emitidos con el euro a 40 y el dolar a 36,50, y 50 USD
// de una factura anterior a las tasas. Las tasas del doble: dolar a 36,50 y euro a 40 desde siempre.
function world(): ReceivablesScenario {
  const s = aReceivablesScenario();

  s.store.customer(TENANT_A, { id: CUSTOMER, code: 'CLI000001', name: 'Comercial Delta', paymentTermDays: 15, creditLimit: 500, isActive: true });
  s.store.invoice(TENANT_A, { id: INVOICE, code: 'FAC000001', customerId: CUSTOMER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'issued', total: 100, ...DOLLARS });
  s.store.invoice(TENANT_A, {
    id: EURO_INVOICE,
    code: 'FAC000002',
    customerId: CUSTOMER,
    issueDate: '2026-01-05',
    dueDate: '2026-01-20',
    status: 'issued',
    total: 100,
    ...DOLLARS,
    currency: 'EUR',
    exchangeRate: 40,
  });
  s.store.invoice(TENANT_A, {
    id: OTHER_INVOICE,
    code: 'FAC000003',
    customerId: CUSTOMER,
    issueDate: '2025-12-26',
    dueDate: '2026-01-20',
    status: 'issued',
    total: 50,
    ...DOLLARS,
    exchangeRate: null,
    baseExchangeRate: null,
  });

  return s;
}

const latest = async (s: ReceivablesScenario) => (await s.searchPayments.run({ tenantId: TENANT_A })).payments[0];

async function collect(s: ReceivablesScenario, allocations: PaymentRequest['allocations'], overrides: Partial<PaymentRequest> = {}) {
  await s.createPayment.run({ tenantId: TENANT_A, customerId: CUSTOMER, method: 'transfer', allocations, ...overrides });
  const payment = await latest(s);
  await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: payment.id });

  return latest(s);
}

describe('collecting in another currency', () => {
  // Lo normal en Venezuela: una factura en dolares que el cliente paga en bolivares a la tasa del dia.
  it('collects a dollar invoice in bolivars at the rate of the payment day and keeps the exchange difference', async () => {
    const s = world();
    s.rates.set('USD', '2026-01-12', 38);

    const payment = await collect(s, [{ invoiceId: INVOICE, amount: 40 }], { currency: 'VES' });

    expect(payment).toMatchObject({
      currency: 'VES',
      amount: 1520,
      amountVes: 1520,
      status: 'confirmed',
      allocations: [{ invoiceId: INVOICE, currency: 'USD', amount: 40, exchangeRate: 38, exchangeDifference: 60 }],
    });
    expect((await s.searchReceivables.run({ tenantId: TENANT_A })).receivables.find((row) => row.id === INVOICE)).toMatchObject({ currency: 'USD', balance: 60 });
  });

  it('converts a payment in euros of a dollar invoice through the bolivar', async () => {
    const s = world();

    const payment = await collect(s, [{ invoiceId: INVOICE, amount: 40 }], { currency: 'EUR' });

    expect(payment).toMatchObject({ currency: 'EUR', exchangeRate: 40, amount: 36.5, amountVes: 1460, allocations: [{ exchangeRate: 36.5, exchangeDifference: 0 }] });
  });

  it('freezes the rates of the payment day when it is confirmed, except a rate written by hand', async () => {
    const s = world();
    await s.createPayment.run({ tenantId: TENANT_A, customerId: CUSTOMER, method: 'transfer', allocations: [{ invoiceId: INVOICE, amount: 40 }] });
    s.rates.set('USD', '2026-01-12', 38);
    await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: (await latest(s)).id });

    expect(await latest(s)).toMatchObject({ exchangeRate: 38, amount: 40, allocations: [{ exchangeRate: 38, exchangeDifference: 60 }] });

    const manual = await collect(s, [{ invoiceId: EURO_INVOICE, amount: 10 }], { currency: 'EUR', exchangeRate: 41 });
    s.rates.set('EUR', '2026-01-14', 45);

    expect(manual).toMatchObject({ exchangeRate: 41, manualExchangeRate: true, amount: 10, allocations: [{ exchangeRate: 41, exchangeDifference: 10 }] });
  });

  it('has no exchange difference for an invoice written before the rates', async () => {
    const payment = await collect(world(), [{ invoiceId: OTHER_INVOICE, amount: 20 }]);

    expect(payment.allocations).toMatchObject([{ exchangeRate: 36.5, exchangeDifference: null }]);
  });

  it('takes no more decimals than the company uses', async () => {
    const s = world();

    await expect(s.createPayment.run({ tenantId: TENANT_A, customerId: CUSTOMER, method: 'cash', allocations: [{ invoiceId: INVOICE, amount: 10.005 }] })).rejects.toThrow(
      InvalidPaymentAmountError,
    );

    s.rates.decimals = 3;

    await expect(s.createPayment.run({ tenantId: TENANT_A, customerId: CUSTOMER, method: 'cash', allocations: [{ invoiceId: INVOICE, amount: 10.005 }] })).resolves.toBeUndefined();
  });
});

describe('what a customer owes, in the company currency', () => {
  // 100 EUR con el euro a 40 y el dolar a 36,50 son 109,59 USD.
  it('adds up balances, aging and credit with the rates of each invoice', async () => {
    const s = world();

    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A })).customers[0]).toMatchObject({ balance: 259.589, availableCredit: 240.411 });
    expect((await s.searchReceivables.run({ tenantId: TENANT_A })).receivables.find((row) => row.id === EURO_INVOICE)).toMatchObject({
      currency: 'EUR',
      balance: 100,
      companyBalance: 109.589,
    });
  });

  it('shows the exchange difference of each payment in the statement, whose last balance matches what is owed', async () => {
    const s = world();
    s.rates.set('USD', '2026-01-12', 38);
    await collect(s, [{ invoiceId: INVOICE, amount: 40 }], { currency: 'VES' });

    const { summary, movements } = await s.searchCustomerStatement.run({ tenantId: TENANT_A, customerId: CUSTOMER });

    expect(movements.find((row) => row.type === 'payment')).toMatchObject({ credit: 40, exchangeDifference: 60 });
    expect(movements.at(-1)?.balance).toBe(summary.balance);
  });
});
