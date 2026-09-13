import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { MovementId } from '../../movement/inventory-movement.entity.js';
import { ItemStock } from '../../stock/item-stock.entity.js';
import { Adjustment } from '../adjustment.entity.js';
import { Ledger, Posting } from './adjustment-posting.js';

// Anular: un borrador solo cambia de estado. Uno confirmado revierte cada movimiento que
// escribio, del ultimo al primero, con otro que lo cita. Si la mercancia que entro ya
// salio, revertir la entrada dejaria la existencia negativa, y se rechaza.
export class AdjustmentCancellation {
  constructor(private readonly ids: IdGenerator) {}

  apply(adjustment: Adjustment, ledger: Ledger, now: Date): Posting {
    const wasConfirmed = adjustment.currentStatus() === 'confirmed';

    adjustment.cancel(now);

    if (!wasConfirmed) {
      return { adjustment, stocks: [], movements: [] };
    }

    const touched = new Map<string, ItemStock>();
    const originals = ledger.movementsOf(adjustment.id).filter((movement) => movement.reversalOfId === null);
    const movements = [...originals]
      .sort((a, b) => b.sequence - a.sequence)
      .map((original) => {
        const stock = ledger.stock(original.itemId, original.warehouseId);
        touched.set(stock.itemId.value, stock);

        return stock.reverse(
          original,
          { type: 'adjustment', id: adjustment.id.value, lineId: original.origin.lineId },
          MovementId.of(this.ids.next()),
          now,
        );
      });

    return { adjustment, stocks: [...touched.values()], movements };
  }
}
