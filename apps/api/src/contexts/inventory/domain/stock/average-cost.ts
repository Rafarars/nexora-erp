import { Quantity } from '../quantity/quantity.vo.js';
import { UnitCost, roundedDivision } from '../quantity/unit-cost.vo.js';

export interface Balance {
  quantity: Quantity;
  averageCost: UnitCost;
}

// Lo que vale un articulo en toda la empresa, ponderado por lo que hay en cada bodega. Es el
// respaldo de una entrada sin costo en una bodega vacia: el articulo cuesta lo mismo este donde
// este. Null cuando no queda existencia en ninguna bodega: ahi no hay nada que promediar.
export function weightedAverageCost(balances: Balance[]): UnitCost | null {
  let units = 0n;
  let value = 0n;

  for (const balance of balances) {
    units += balance.quantity.units;
    value += balance.quantity.units * balance.averageCost.micros;
  }

  return units === 0n ? null : UnitCost.fromMicros(roundedDivision(value, units));
}
