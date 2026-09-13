import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { MovementId } from '../../movement/inventory-movement.entity.js';
import { ItemStock } from '../../stock/item-stock.entity.js';
import { Adjustment } from '../adjustment.entity.js';
import { Ledger, Posting } from './adjustment-posting.js';

// Confirmar: cada linea mueve la existencia de su articulo en la bodega del ajuste, en el
// orden de las lineas. Si una salida no alcanza, el error aborta todo el ajuste.
export class AdjustmentConfirmation {
  constructor(private readonly ids: IdGenerator) {}

  apply(adjustment: Adjustment, ledger: Ledger, now: Date): Posting {
    adjustment.confirm(now);

    const touched = new Map<string, ItemStock>();
    const movements = adjustment.lines().map((line) => {
      const stock = ledger.stock(line.itemId, adjustment.warehouseId());
      const origin = { type: 'adjustment' as const, id: adjustment.id.value, lineId: line.id.value };
      const id = MovementId.of(this.ids.next());

      touched.set(stock.itemId.value, stock);

      return line.direction === 'in'
        ? stock.receive(line.baseQuantity, line.baseUnitCost(stock.currentAverageCost()), origin, id, now)
        : stock.release(line.baseQuantity, origin, id, now);
    });

    return { adjustment, stocks: [...touched.values()], movements };
  }
}
