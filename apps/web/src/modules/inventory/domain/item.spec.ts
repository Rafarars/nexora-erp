import { describe, expect, it } from 'vitest';
import { describeUnits, suggestedPrice } from './item';

const unit = (overrides: Partial<{ unitId: string; abbreviation: string; conversionFactor: number; isBase: boolean }>) => ({
  unitId: 'u',
  name: 'Unidad',
  abbreviation: 'un',
  conversionFactor: 1,
  isBase: false,
  ...overrides,
});

describe('describeUnits', () => {
  it('reads as a warehouse would say it', () => {
    const units = [unit({ isBase: true }), unit({ unitId: 'c', abbreviation: 'cja', conversionFactor: 24 })];

    expect(describeUnits(units)).toBe('un · 1 cja = 24 un');
  });

  it('shows just the base when there is nothing else', () => {
    expect(describeUnits([unit({ abbreviation: 'kg', isBase: true })])).toBe('kg');
  });

  it('writes decimals the Spanish way', () => {
    const units = [unit({ abbreviation: 'kg', isBase: true }), unit({ abbreviation: 'saco', conversionFactor: 0.5 })];

    expect(describeUnits(units)).toBe('kg · 1 saco = 0,5 kg');
  });

  it('returns nothing without a base unit', () => {
    expect(describeUnits([unit({})])).toBe('');
  });
});

// Lo que la pantalla puede sugerir sin preguntar al servidor.
describe('suggestedPrice', () => {
  const water = {
    id: 'w', code: 'ART000001', sku: 'AGUA', name: 'Agua', description: null, type: 'inventoried' as const,
    category: null, barcode: null, isPurchasable: true, isSellable: true, reorderRules: [],
    salesTax: null, purchaseTax: null, minPrice: null, isActive: true,
    units: [unit({ unitId: 'u', isBase: true }), unit({ unitId: 'c', abbreviation: 'cja', conversionFactor: 12.5 })],
    prices: [{ priceList: { id: 'detal', name: 'Detal', currency: 'USD' }, price: 0.85 }],
  };
  const detal = { id: 'detal', currency: 'USD' };

  it('multiplies the base price by the factor of the chosen unit', () => {
    expect(suggestedPrice(water, 'c', detal, 'USD', 6)).toBe(10.625);
  });

  // Sin redondear, el formulario mandaria 10,625 y la API rechazaria el pedido por decimales.
  it('rounds to the decimals the company uses for prices', () => {
    expect(suggestedPrice(water, 'c', detal, 'USD', 2)).toBe(10.63);
  });

  // La conversión entre monedas la hace el servidor, con la tasa del día.
  it('suggests nothing when the list is in another currency', () => {
    expect(suggestedPrice(water, 'u', detal, 'EUR', 2)).toBeNull();
  });

  it('suggests nothing when the item has no price in that list', () => {
    expect(suggestedPrice(water, 'u', { id: 'mayorista', currency: 'USD' }, 'USD', 2)).toBeNull();
  });
});
