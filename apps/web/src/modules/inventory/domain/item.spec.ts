import { describe, expect, it } from 'vitest';
import { describeUnits } from './item';

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
