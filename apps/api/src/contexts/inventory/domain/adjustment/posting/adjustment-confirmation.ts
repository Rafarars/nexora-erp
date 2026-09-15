import { StockItemChangedError } from '../../errors/inventory.errors.js';
import { StockMovements } from '../../stock/posting/stock-movements.js';
import { Ledger } from '../../stock/posting/stock-ledger.js';
import { Adjustment } from '../adjustment.entity.js';
import { Posting } from './adjustment-posting.js';

// Confirmar: cada linea mueve la existencia de su articulo en la bodega del ajuste, en el
// orden de las lineas. Si una salida no alcanza, el error aborta todo el ajuste.
//
// Las cantidades base se comprobaron al revalidar el borrador, antes de bloquear nada. Si el
// articulo cambio su unidad en ese instante, el ajuste no se confirma con cantidades viejas: se
// rechaza igual que un borrador viejo, para revisarlo y guardarlo con el catalogo de hoy.
export class AdjustmentConfirmation {
  constructor(private readonly movements: StockMovements) {}

  apply(adjustment: Adjustment, ledger: Ledger, now: Date): Posting {
    for (const line of adjustment.lines()) {
      const factor = ledger.item(line.itemId).factorOf(line.unitId);

      if (factor === null || !line.quantity.times(factor).equals(line.baseQuantity)) {
        throw new StockItemChangedError(line.itemId.value);
      }
    }

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
