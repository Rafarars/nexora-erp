import { describe, expect, it } from 'vitest';
import { MissingExchangeRateError, PriceDecimalsExceededError } from '../../../shared/domain/ports/document-rates.js';
import { CreditLimitExceededError } from '../domain/errors/sales.errors.js';
import { BOX, MAIN, TENANT_A, WATER } from '../domain/testing/sales.mother.js';
import { SalesOrderCreatorRequest } from './create-order/sales-order-creator.js';
import { SalesScenario, aSalesScenario } from './testing/sales-scenario.js';

// La moneda de las ventas: el pedido con las tasas de su dia, la factura con las de su emision y
// sus importes en bolivares, y el credito del cliente en la moneda de la empresa. El doble de tasas
// tiene el dolar a 36,50 y el euro a 40 desde siempre.
async function world(customer: { paymentTermDays?: number; creditLimit?: number | null } = {}) {
  const s = aSalesScenario();
  await s.createCustomer.run({ tenantId: TENANT_A, name: 'Comercial Delta', paymentTermDays: 15, creditLimit: null, ...customer });
  const [{ id: customerId }] = (await s.searchCustomers.run({ tenantId: TENANT_A })).customers;
  s.store.stock(TENANT_A, WATER, MAIN, 480);

  // 10 cajas de agua a 30 con 16 %: 300 + 48 = 348.
  const order = (overrides: Partial<SalesOrderCreatorRequest> = {}) =>
    s.createOrder.run({ tenantId: TENANT_A, customerId, warehouseId: MAIN, lines: [{ itemId: WATER, unitId: BOX, quantity: 10, unitPrice: 30 }], ...overrides });

  return { s, order };
}

const latestOrder = async (s: SalesScenario) => (await s.searchOrders.run({ tenantId: TENANT_A })).orders[0];
const latestInvoice = async (s: SalesScenario) => (await s.searchInvoices.run({ tenantId: TENANT_A })).invoices[0];

// Confirma el ultimo pedido, despacha todo y devuelve el despacho confirmado.
async function dispatchAll(s: SalesScenario): Promise<string> {
  const order = await latestOrder(s);
  await s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });
  await s.createDispatch.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 10 }] });
  const [dispatch] = (await s.searchDispatches.run({ tenantId: TENANT_A })).dispatches;
  await s.confirmDispatch.run({ tenantId: TENANT_A, dispatchId: dispatch.id });

  return dispatch.id;
}

describe('the currency of a sales order', () => {
  it('is the company currency with the rates of the order date when the order does not say', async () => {
    const { s, order } = await world();

    await order();

    expect(await latestOrder(s)).toMatchObject({ currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualExchangeRate: false, totals: { total: 348 } });
  });

  it('keeps a rate written by hand when it is confirmed, and freezes the automatic one', async () => {
    const { s, order } = await world();
    await order({ currency: 'EUR', exchangeRate: 42.5 });
    s.rates.set('EUR', '2026-01-10', 41);

    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: (await latestOrder(s)).id });

    expect(await latestOrder(s)).toMatchObject({ status: 'confirmed', currency: 'EUR', exchangeRate: 42.5, manualExchangeRate: true });
  });

  it('is not saved without a rate for its currency on its date', async () => {
    const { s, order } = await world();
    s.rates.clear('EUR');

    await expect(order({ currency: 'EUR' })).rejects.toThrow(MissingExchangeRateError);
    expect((await s.searchOrders.run({ tenantId: TENANT_A })).orders).toEqual([]);
  });
});

describe('the currency of an invoice', () => {
  // La ley pide la tasa de la factura, no la del pedido que le dio origen.
  it('takes the currency of its order with the rates of the day it is issued, and its amounts in bolivars', async () => {
    const { s, order } = await world();
    await order({ currency: 'EUR', date: '2026-01-10' });
    s.rates.set('EUR', '2026-01-12', 41);

    await s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: await dispatchAll(s) });

    expect(await latestInvoice(s)).toMatchObject({
      currency: 'EUR',
      exchangeRate: 41,
      baseCurrency: 'USD',
      baseExchangeRate: 36.5,
      subtotal: 300,
      tax: 48,
      total: 348,
      subtotalVes: 12300,
      taxVes: 1968,
      totalVes: 14268,
    });
    expect(await latestOrder(s)).toMatchObject({ exchangeRate: 40 });
  });

  it('refuses a price with more decimals than the prices of the company', async () => {
    const { s, order } = await world();
    s.rates.prices = 2;

    await expect(order({ lines: [{ itemId: WATER, unitId: BOX, quantity: 1, unitPrice: 30.155 }] })).rejects.toThrow(PriceDecimalsExceededError);
    await expect(order({ lines: [{ itemId: WATER, unitId: BOX, quantity: 1, unitPrice: 30.15 }] })).resolves.toBeUndefined();
  });

  it('rounds its amounts to the decimals of the company', async () => {
    const { s, order } = await world();
    s.rates.decimals = 0;
    await order({ lines: [{ itemId: WATER, unitId: BOX, quantity: 10, unitPrice: 30.15 }] });

    await s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: await dispatchAll(s) });

    // 301,50 se redondea a 302 y el 16 % de 302 son 48,32, que se redondea a 48.
    expect(await latestInvoice(s)).toMatchObject({ subtotal: 302, tax: 48, total: 350, totalVes: 12775 });
  });

  // 348 EUR con el euro a 40 y el dolar a 36,50 son 381,37 USD.
  it('counts against the credit limit in the company currency', async () => {
    const tight = await world({ creditLimit: 381 });
    await tight.order({ currency: 'EUR' });

    await expect(tight.s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: await dispatchAll(tight.s) })).rejects.toThrow(CreditLimitExceededError);

    const enough = await world({ creditLimit: 381.37 });
    await enough.order({ currency: 'EUR' });

    await expect(enough.s.issueInvoice.run({ tenantId: TENANT_A, dispatchId: await dispatchAll(enough.s) })).resolves.toBeUndefined();
  });

  it('is not issued without a rate for its currency on the day it is issued', async () => {
    const { s, order } = await world();
    await order({ currency: 'EUR' });
    const dispatchId = await dispatchAll(s);
    s.rates.clear('EUR');

    await expect(s.issueInvoice.run({ tenantId: TENANT_A, dispatchId })).rejects.toThrow(MissingExchangeRateError);
    expect((await s.searchInvoices.run({ tenantId: TENANT_A })).invoices).toEqual([]);
  });
});
