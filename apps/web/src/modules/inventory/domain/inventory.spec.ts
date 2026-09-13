import { describe, expect, it } from 'vitest';
import { availableActions, formatCost, formatMoney, formatQuantity, summarizeLines } from './inventory';
import type { AdjustmentLine } from './inventory';

describe('availableActions', () => {
  it('offers everything on a draft', () => {
    expect(availableActions({ status: 'draft' })).toEqual({ edit: true, confirm: true, cancel: true });
  });

  // Lo confirmado ya movio existencia: solo se puede anular, que escribe la contrapartida.
  it('offers only cancelling a confirmed adjustment', () => {
    expect(availableActions({ status: 'confirmed' })).toEqual({ edit: false, confirm: false, cancel: true });
  });

  it('offers nothing on a cancelled adjustment', () => {
    expect(availableActions({ status: 'cancelled' })).toEqual({ edit: false, confirm: false, cancel: false });
  });
});

describe('summarizeLines', () => {
  const line = (overrides: Partial<AdjustmentLine>): AdjustmentLine => ({
    lineNumber: 1,
    itemId: 'water',
    sku: 'AGUA-500',
    itemName: 'Agua',
    unitId: 'box',
    unitAbbreviation: 'cja',
    direction: 'in',
    quantity: 2,
    baseQuantity: 48,
    unitCost: 12,
    ...overrides,
  });

  it('shows the base quantity only when the unit is not the base one', () => {
    const text = summarizeLines([line({}), line({ direction: 'out', unitAbbreviation: 'un', quantity: 1, baseQuantity: 1 })], () => 'un');

    expect(text).toBe('+2 cja (48 un) AGUA-500 · −1 un AGUA-500');
  });
});

describe('formatting', () => {
  it('writes quantities with a decimal comma and no thousands separator', () => {
    expect(formatQuantity(12345.5)).toBe('12345,5');
  });

  it('keeps the six decimals of a cost, so editing a draft does not round it', () => {
    expect(formatCost(0.333333)).toBe('0,333333');
    expect(formatCost(12)).toBe('12');
  });

  it('writes money with at least two decimals', () => {
    expect(formatMoney(120)).toBe('120,00');
    expect(formatMoney(0.333333)).toBe('0,333333');
  });
});
