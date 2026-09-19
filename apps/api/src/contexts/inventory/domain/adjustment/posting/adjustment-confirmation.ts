import { NothingToRevalueError, StockItemChangedError } from '../../errors/inventory.errors.js';
import { StockEntry, StockMovements } from '../../stock/posting/stock-movements.js';
import { Ledger } from '../../stock/posting/stock-ledger.js';
import { Adjustment, isRevaluation } from '../adjustment.entity.js';
import { Posting } from './adjustment-posting.js';

// Confirmar: cada linea mueve la existencia de su articulo en la bodega del ajuste, en el
// orden de las lineas. Si una salida no alcanza, el error aborta todo el ajuste.
//
// Las cantidades base se comprobaron al revalidar el borrador, antes de bloquear nada. Si el
// articulo cambio su unidad en ese instante, el ajuste no se confirma con cantidades viejas: se
// rechaza igual que un borrador viejo, para revisarlo y guardarlo con los articulos de hoy.
export class AdjustmentConfirmation {
  constructor(private readonly movements: StockMovements) {}

  apply(adjustment: Adjustment, ledger: Ledger, now: Date, userId: string | null = null): Posting {
    const entries = isRevaluation(adjustment.type())
      ? this.revaluationEntries(adjustment, ledger)
      : this.movementEntries(adjustment, ledger);

    adjustment.confirm(now, userId);

    const changes = this.movements.record(
      ledger,
      { type: 'adjustment', id: adjustment.id.value, date: adjustment.date().value },
      entries,
      now,
    );

    return { adjustment, ...changes };
  }

  private movementEntries(adjustment: Adjustment, ledger: Ledger): StockEntry[] {
    for (const line of adjustment.lines()) {
      const factor = ledger.item(line.itemId).factorOf(line.unitId);

      if (factor === null || !line.quantity.times(factor).equals(line.baseQuantity)) {
        throw new StockItemChangedError(line.itemId.value);
      }
    }

    return adjustment.lines().map((line) => ({
      lineId: line.id.value,
      itemId: line.itemId,
      warehouseId: adjustment.warehouseId(),
      direction: line.direction,
      quantity: line.baseQuantity,
      unitCost: line.unitCost ? line.unitCost.perBase(line.quantity, line.baseQuantity) : null,
    }));
  }

  // Revaluar no cambia cuanto hay, cambia cuanto vale: sale todo al costo viejo y vuelve a
  // entrar al nuevo. El kardex no sabe escribir un movimiento de cantidad cero, y expresarlo
  // asi deja el rastro de por donde paso el promedio. Cuanto sale es lo que hay AHORA, ya
  // bloqueado; una linea sin existencia no escribe nada.
  private revaluationEntries(adjustment: Adjustment, ledger: Ledger): StockEntry[] {
    const entries = adjustment.lines().flatMap((line): StockEntry[] => {
      const warehouseId = adjustment.warehouseId();
      const quantity = ledger.stock(line.itemId, warehouseId).available();

      if (quantity.isZero()) return [];

      const common = { lineId: line.id.value, itemId: line.itemId, warehouseId, quantity };

      return [
        { ...common, direction: 'out' as const, unitCost: null },
        { ...common, direction: 'in' as const, unitCost: line.unitCost },
      ];
    });

    if (entries.length === 0) throw new NothingToRevalueError(adjustment.id.value);

    return entries;
  }
}
