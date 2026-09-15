import { describe, expect, it } from 'vitest';
import { MissingExchangeRateError, RateOverrideNotAllowedError } from '../../../shared/domain/ports/document-rates.js';
import { BOX, MAIN, TENANT_A, WATER } from '../domain/testing/purchasing.mother.js';
import { PurchaseOrderCreatorRequest } from './create-order/purchase-order-creator.js';
import { PurchasingScenario, aPurchasingScenario } from './testing/purchasing-scenario.js';

// La moneda de las compras: la de la empresa si la orden no dice otra, tasas que se refrescan en el
// borrador y se congelan al confirmar, y la entrada con las tasas del dia en que llego.
async function world() {
  const s = aPurchasingScenario();
  await s.createSupplier.run({ tenantId: TENANT_A, name: 'Distribuidora Andina' });
  const [supplier] = (await s.searchSuppliers.run({ tenantId: TENANT_A })).suppliers;
  const create = (overrides: Partial<PurchaseOrderCreatorRequest> = {}) =>
    s.createOrder.run({ tenantId: TENANT_A, supplierId: supplier.id, warehouseId: MAIN, lines: [{ itemId: WATER, unitId: BOX, quantity: 10, unitCost: 12 }], ...overrides });

  return { s, create };
}

const latestOrder = async (s: PurchasingScenario) => (await s.searchOrders.run({ tenantId: TENANT_A })).orders[0];
const latestReceipt = async (s: PurchasingScenario) => (await s.searchReceipts.run({ tenantId: TENANT_A })).receipts[0];

describe('the currency of a purchase order', () => {
  it('is the company currency with the rates of the order date when the order does not say', async () => {
    const { s, create } = await world();

    await create();

    expect(await latestOrder(s)).toMatchObject({ currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualExchangeRate: false });
  });

  it('refreshes the rates while it is a draft and freezes them when it is confirmed', async () => {
    const { s, create } = await world();
    await create({ currency: 'eur' });
    const draft = await latestOrder(s);

    expect(draft).toMatchObject({ currency: 'EUR', exchangeRate: 40, baseExchangeRate: 36.5 });

    s.rates.set('EUR', '2026-01-10', 41);
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: draft.id });
    s.rates.set('EUR', '2026-01-12', 45);

    expect(await latestOrder(s)).toMatchObject({ status: 'confirmed', exchangeRate: 41 });
  });

  it('keeps a rate written by hand through the confirmation', async () => {
    const { s, create } = await world();
    await create({ currency: 'EUR', exchangeRate: 42.5 });
    s.rates.set('EUR', '2026-01-10', 41);

    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: (await latestOrder(s)).id });

    expect(await latestOrder(s)).toMatchObject({ exchangeRate: 42.5, baseExchangeRate: 36.5, manualExchangeRate: true });
  });

  it('is not saved with a written rate the company does not allow, nor without a rate on its date', async () => {
    const { s, create } = await world();
    s.rates.allowsOverride = false;

    await expect(create({ currency: 'EUR', exchangeRate: 42 })).rejects.toThrow(RateOverrideNotAllowedError);

    s.rates.clear('EUR');

    await expect(create({ currency: 'EUR' })).rejects.toThrow(MissingExchangeRateError);
    expect((await s.searchOrders.run({ tenantId: TENANT_A })).orders).toEqual([]);
  });
});

describe('the currency of a goods receipt', () => {
  it('is the currency of its order with the rates of the day it arrived, frozen when it is confirmed', async () => {
    const { s, create } = await world();
    await create({ currency: 'EUR' });
    const order = await latestOrder(s);
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });
    s.rates.set('EUR', '2026-01-15', 43);

    await s.createReceipt.run({ tenantId: TENANT_A, orderId: order.id, lines: [{ orderLineId: order.lines[0].id, quantity: 4 }] });
    const receipt = await latestReceipt(s);

    expect(receipt).toMatchObject({ currency: 'EUR', exchangeRate: 43, baseCurrency: 'USD', baseExchangeRate: 36.5, manualExchangeRate: false });

    s.rates.set('EUR', '2026-01-15', 44);
    await s.confirmReceipt.run({ tenantId: TENANT_A, receiptId: receipt.id });

    expect(await latestReceipt(s)).toMatchObject({ status: 'confirmed', exchangeRate: 44 });
    expect(await latestOrder(s)).toMatchObject({ exchangeRate: 40 });
  });

  it('keeps a rate written by hand', async () => {
    const { s, create } = await world();
    await create({ currency: 'EUR' });
    const order = await latestOrder(s);
    await s.confirmOrder.run({ tenantId: TENANT_A, orderId: order.id });

    await s.createReceipt.run({ tenantId: TENANT_A, orderId: order.id, exchangeRate: 39.75, lines: [{ orderLineId: order.lines[0].id, quantity: 4 }] });
    await s.confirmReceipt.run({ tenantId: TENANT_A, receiptId: (await latestReceipt(s)).id });

    expect(await latestReceipt(s)).toMatchObject({ exchangeRate: 39.75, manualExchangeRate: true });
  });
});
