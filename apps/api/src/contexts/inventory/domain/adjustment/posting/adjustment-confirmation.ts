import { StockMovements } from '../../stock/posting/stock-movements.js';
import { Ledger } from '../../stock/posting/stock-ledger.js';
import { Adjustment } from '../adjustment.entity.js';
import { Posting } from './adjustment-posting.js';

// Confirmar: cada linea mueve la existencia de su articulo en la bodega del ajuste, en el
// orden de las lineas. Si una salida no alcanza, el error aborta todo el ajuste.
export class AdjustmentConfirmation {
  constructor(private readonly movements: StockMovements) {}

  apply(adjustment: Adjustment, ledger: Ledger, now: Date): Posting {
    adjustment.confirm(now);

    const changes = this.movements.record(
      ledger,
      { type: 'adjustment', id: adjustment.id.value },
      adjustment.lines().map((line) => ({
        lineId: line.id.value,
        itemId: line.itemId,
        warehouseId: adjustment.warehouseId(),
        direction: line.direction,
        quantity: line.baseQuantity,
        unitCost: line.unitCost ? line.unitCost.perBase(line.quantity, line.baseQuantity) : null,
      })),
      now,
    );

    return { adjustment, ...changes };
  }
}
