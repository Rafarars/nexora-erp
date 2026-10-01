import { NothingToRevalueError, StockItemChangedError } from '../../errors/inventory.errors.js';
import { StockEntry, StockMovements } from '../../stock/posting/stock-movements.js';
import { Ledger } from '../../stock/posting/stock-ledger.js';
import { UnitCost } from '../../quantity/unit-cost.vo.js';
import { calculatePriceVariance } from '../../stock/price-variance.js';
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
  //
  // Si la linea es por importe (H9 §3.3), reparte con PriceVariance entre bodega y resultado:
  // si ya salio todo no escribe kardex pero se confirma igual (no lanza NothingToRevalueError).
  private revaluationEntries(adjustment: Adjustment, ledger: Ledger): StockEntry[] {
    let hasAmountLines = false;

    const entries = adjustment.lines().flatMap((line): StockEntry[] => {
      const warehouseId = adjustment.warehouseId();
      const stock = ledger.stock(line.itemId, warehouseId);
      const quantity = stock.available();

      if (line.revaluationKind === 'amount') {
        hasAmountLines = true;
        const amount = line.amount ?? 0;
        const subsequent = line.sourceMovementId
          ? ledger.movementsSince(line.itemId, warehouseId, line.sourceMovementId)
          : [];
        const { stockPart, soldPart } = calculatePriceVariance(amount, line.sourceMovementId ?? '', subsequent);

        if (quantity.isZero() || stockPart === 0) {
          line.allocateVariance(stockPart, soldPart, null);
          return [];
        }

        const currentValue = quantity.toNumber() * stock.currentAverageCost().toNumber();
        let effectiveStockPart = stockPart;
        let effectiveSoldPart = soldPart;

        if (stockPart < 0 && currentValue + stockPart < 0) {
          const unabsorbed = currentValue + stockPart;
          effectiveStockPart = -currentValue;
          effectiveSoldPart = soldPart + unabsorbed;
        }

        const newValue = currentValue + effectiveStockPart;
        const newCostNumber = Math.max(0, newValue / quantity.toNumber());
        const newUnitCost = UnitCost.of(newCostNumber);

        line.allocateVariance(effectiveStockPart, effectiveSoldPart, newUnitCost);

        const common = { lineId: line.id.value, itemId: line.itemId, warehouseId, quantity };
        return [
          { ...common, direction: 'out' as const, unitCost: null },
          { ...common, direction: 'in' as const, unitCost: newUnitCost },
        ];
      }

      if (quantity.isZero()) return [];

      const common = { lineId: line.id.value, itemId: line.itemId, warehouseId, quantity };

      return [
        { ...common, direction: 'out' as const, unitCost: null },
        { ...common, direction: 'in' as const, unitCost: line.unitCost },
      ];
    });

    if (entries.length === 0 && !hasAmountLines) throw new NothingToRevalueError(adjustment.id.value);

    return entries;
  }
}
