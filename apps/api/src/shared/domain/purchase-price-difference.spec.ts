import { describe, expect, it } from 'vitest';
import { calculatePurchasePriceDifference, effectiveRateToBase } from './purchase-price-difference.js';

describe('effectiveRateToBase', () => {
  it('returns 1 when document currency is the company base currency', () => {
    expect(effectiveRateToBase('USD', 'USD', 36.5, 36.5)).toBe(1);
    expect(effectiveRateToBase('VES', 'VES', null, null)).toBe(1);
  });

  it('returns 1 when exchange rate or base exchange rate is missing', () => {
    expect(effectiveRateToBase('USD', 'VES', null, 36.5)).toBe(1);
    expect(effectiveRateToBase('USD', 'VES', 36.5, null)).toBe(1);
  });

  it('computes division of rate by base rate when currencies differ', () => {
    // Moneda del doc USD a 150 Bs, base USD a 150 Bs -> 1
    expect(effectiveRateToBase('USD', 'USD', 150, 150)).toBe(1);
    // Moneda del doc EUR a 160 Bs, base USD a 150 Bs -> 160 / 150
    expect(effectiveRateToBase('EUR', 'USD', 160, 150)).toBeCloseTo(160 / 150, 6);
  });
});

describe('calculatePurchasePriceDifference (H9 §3.3)', () => {
  it('computes zero price difference and full exchange difference when prices match in USD but rate changed (H9 §7)', () => {
    // 10 unidades a USD 10 entraron a 150 Bs. Factura dice USD 10 a 155 Bs.
    // Diferencia de precio = 0 Bs
    // Diferencia en cambio = 10 * 10 * (155 - 150) = 500 Bs
    const res = calculatePurchasePriceDifference([
      {
        quantity: 10,
        invoiceUnitPrice: 10,
        invoiceRate: 155,
        receiptUnitCost: 10,
        receiptRate: 150,
      },
    ]);

    expect(res.priceDifference).toBe(0);
    expect(res.exchangeDifference).toBe(500);
    expect(res.lineDifferences[0].unitDifferenceDoc).toBe(0);
  });

  it('computes price difference in base currency when invoice is more expensive at same exchange rate', () => {
    // 5 unidades entraron a 20 USD con tasa 150 Bs. Factura dice 25 USD con tasa 150 Bs.
    // Diferencia de precio en USD = (25 - 20) * 5 = +25 USD
    // En Bs = +25 * 150 = +3750 Bs
    // Diferencia en cambio = 0 Bs
    const res = calculatePurchasePriceDifference([
      {
        quantity: 5,
        invoiceUnitPrice: 25,
        invoiceRate: 150,
        receiptUnitCost: 20,
        receiptRate: 150,
      },
    ]);

    expect(res.priceDifference).toBe(3750);
    expect(res.exchangeDifference).toBe(0);
    expect(res.lineDifferences[0].unitDifferenceDoc).toBe(5);
  });

  it('computes negative price difference when invoice is cheaper', () => {
    // 10 unidades a 100 USD con tasa 1. Factura dice 80 USD con tasa 1.
    // Diferencia de precio = -20 * 10 = -200 USD
    const res = calculatePurchasePriceDifference([
      {
        quantity: 10,
        invoiceUnitPrice: 80,
        invoiceRate: 1,
        receiptUnitCost: 100,
        receiptRate: 1,
      },
    ]);

    expect(res.priceDifference).toBe(-200);
    expect(res.exchangeDifference).toBe(0);
  });

  it('combines price difference and exchange difference simultaneously', () => {
    // 10 unidades a 10 USD (tasa entrada 150). Factura a 12 USD (tasa factura 160).
    // unitDiffDoc = +2 USD
    // totalDiffDoc = +20 USD
    // priceDifferenceBase (a tasa de entrada 150) = 20 * 150 = 3000 Bs
    // exchangeDifferenceBase = 10 * 12 * (160 - 150) = 120 * 10 = 1200 Bs
    const res = calculatePurchasePriceDifference([
      {
        quantity: 10,
        invoiceUnitPrice: 12,
        invoiceRate: 160,
        receiptUnitCost: 10,
        receiptRate: 150,
      },
    ]);

    expect(res.priceDifference).toBe(3000);
    expect(res.exchangeDifference).toBe(1200);
  });

  it('returns zeroes when there are no lines', () => {
    const res = calculatePurchasePriceDifference([]);
    expect(res.priceDifference).toBe(0);
    expect(res.exchangeDifference).toBe(0);
  });
});
