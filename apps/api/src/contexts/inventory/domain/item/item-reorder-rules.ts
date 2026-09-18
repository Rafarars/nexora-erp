import { InvalidReorderRuleError } from '../errors/item.errors.js';
import { Quantity } from '../quantity/quantity.vo.js';
import { WarehouseRef } from '../shared/references.vo.js';

export interface ItemReorderRulePrimitives {
  warehouseId: string;
  minQuantity: number;
  maxQuantity: number | null;
  reorderQuantity: number;
}

// Cuanto se quiere tener de un articulo en UNA bodega, en su unidad base: por debajo del minimo hay
// que reponer, y `reorderQuantity` es lo que se sugiere pedir. Los ERP lo llevan asi, por bodega, y
// no plano en el articulo: lo que falta en la principal no se cubre con lo que sobra en la otra.
export class ItemReorderRule {
  private constructor(
    readonly warehouseId: WarehouseRef,
    readonly minQuantity: Quantity,
    readonly maxQuantity: Quantity | null,
    readonly reorderQuantity: Quantity,
  ) {}

  static of(row: ItemReorderRulePrimitives): ItemReorderRule {
    const min = quantity(row.minQuantity, 'minQuantity');
    const max = row.maxQuantity === null || row.maxQuantity === undefined ? null : quantity(row.maxQuantity, 'maxQuantity');

    if (max && min.isGreaterThan(max)) throw new InvalidReorderRuleError('the maximum cannot be lower than the minimum.');

    return new ItemReorderRule(WarehouseRef.of(row.warehouseId), min, max, quantity(row.reorderQuantity, 'reorderQuantity'));
  }

  toPrimitives(): ItemReorderRulePrimitives {
    return {
      warehouseId: this.warehouseId.value,
      minQuantity: this.minQuantity.toNumber(),
      maxQuantity: this.maxQuantity === null ? null : this.maxQuantity.toNumber(),
      reorderQuantity: this.reorderQuantity.toNumber(),
    };
  }
}

// Las reglas de un articulo, una por bodega como mucho.
export class ItemReorderRules {
  private constructor(private readonly rules: ItemReorderRule[]) {}

  static of(rules: ItemReorderRule[]): ItemReorderRules {
    const ids = rules.map((rule) => rule.warehouseId.value);

    if (new Set(ids).size !== ids.length) throw new InvalidReorderRuleError('a warehouse appears more than once.');

    return new ItemReorderRules([...rules].sort((left, right) => left.warehouseId.value.localeCompare(right.warehouseId.value)));
  }

  static fromPrimitives(rows: ItemReorderRulePrimitives[]): ItemReorderRules {
    return ItemReorderRules.of(rows.map((row) => ItemReorderRule.of(row)));
  }

  static none(): ItemReorderRules {
    return new ItemReorderRules([]);
  }

  warehouseIds(): WarehouseRef[] {
    return this.rules.map((rule) => rule.warehouseId);
  }

  toPrimitives(): ItemReorderRulePrimitives[] {
    return this.rules.map((rule) => rule.toPrimitives());
  }
}

function quantity(value: number, name: string): Quantity {
  if (!Number.isFinite(value) || value < 0) throw new InvalidReorderRuleError(`${name} must be zero or more.`);

  return Quantity.of(value);
}
