import { describe, expect, it } from 'vitest';
import { InvalidReorderRuleError } from '../errors/item.errors.js';
import { WAREHOUSE_A, WAREHOUSE_B } from '../testing/item.mother.js';
import { ItemReorderRule, ItemReorderRules } from './item-reorder-rules.js';

const rule = (warehouseId: string, min: number, max: number | null = null, reorder = 0) =>
  ItemReorderRule.of({ warehouseId, minQuantity: min, maxQuantity: max, reorderQuantity: reorder });

describe('ItemReorderRules', () => {
  it('keeps what it was given, with the maximum optional', () => {
    const rules = ItemReorderRules.of([rule(WAREHOUSE_A, 300, 900, 600)]);

    expect(rules.toPrimitives()).toEqual([{ warehouseId: WAREHOUSE_A, minQuantity: 300, maxQuantity: 900, reorderQuantity: 600 }]);
  });

  // Lo que falta en una bodega no se cubre con lo que sobra en otra: una regla por bodega.
  it('refuses two rules for the same warehouse', () => {
    expect(() => ItemReorderRules.of([rule(WAREHOUSE_A, 1), rule(WAREHOUSE_A, 2)])).toThrow(InvalidReorderRuleError);
    expect(() => ItemReorderRules.of([rule(WAREHOUSE_A, 1), rule(WAREHOUSE_B, 2)])).not.toThrow();
  });

  it('refuses negative quantities and a maximum below the minimum', () => {
    expect(() => rule(WAREHOUSE_A, -1)).toThrow(InvalidReorderRuleError);
    expect(() => rule(WAREHOUSE_A, 10, 9)).toThrow(InvalidReorderRuleError);
    expect(() => rule(WAREHOUSE_A, 10, 10)).not.toThrow();
  });
});
