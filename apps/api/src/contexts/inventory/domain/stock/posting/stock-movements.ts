import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { InactiveStockItemError, ServiceHasNoStockError } from '../../errors/inventory.errors.js';
import { MovementId, MovementOrigin, StockDirection } from '../../movement/inventory-movement.entity.js';
import { Quantity } from '../../quantity/quantity.vo.js';
import { UnitCost } from '../../quantity/unit-cost.vo.js';
import { ItemRef, WarehouseRef } from '../../shared/references.vo.js';
import { ItemStock } from '../item-stock.entity.js';
import { Ledger, StockChanges } from './stock-ledger.js';

// Una linea de cualquier documento ya expresada en unidad base. Sin costo, una entrada se
// valora al promedio vigente.
export interface StockEntry {
  lineId: string;
  itemId: ItemRef;
  warehouseId: WarehouseRef;
  direction: StockDirection;
  quantity: Quantity;
  unitCost: UnitCost | null;
}

// Lo que tienen en comun todos los documentos que mueven existencia, sea un ajuste o una
// entrada de mercancia: registrar sus lineas y, al anularlos, revertir lo que escribieron.
// Puro: si una salida no alcanza, lanza antes de que nadie escriba nada.
export class StockMovements {
  constructor(private readonly ids: IdGenerator) {}

  record(ledger: Ledger, document: { type: MovementOrigin['type']; id: string }, entries: StockEntry[], now: Date): StockChanges {
    const touched = new Map<string, ItemStock>();
    const movements = entries.map((entry) => {
      ensureMovable(ledger, entry.itemId);

      const stock = ledger.stock(entry.itemId, entry.warehouseId);
      const origin = { type: document.type, id: document.id, lineId: entry.lineId };
      const id = MovementId.of(this.ids.next());

      touched.set(keyOf(stock), stock);

      return entry.direction === 'in'
        ? stock.receive(entry.quantity, entry.unitCost ?? stock.currentAverageCost(), origin, id, now)
        : stock.release(entry.quantity, origin, id, now);
    });

    return { stocks: [...touched.values()], movements };
  }

  // Del ultimo al primero, cada movimiento original con otro que lo cita. Si la mercancia
  // que entro ya salio, revertir la entrada dejaria la existencia negativa, y se rechaza.
  reverse(ledger: Ledger, document: { type: MovementOrigin['type']; id: string }, now: Date): StockChanges {
    const touched = new Map<string, ItemStock>();
    const originals = ledger.movementsOf(document.id).filter((movement) => movement.reversalOfId === null);
    const movements = [...originals]
      .sort((a, b) => b.sequence - a.sequence)
      .map((original) => {
        ensureMovable(ledger, original.itemId);

        const stock = ledger.stock(original.itemId, original.warehouseId);
        touched.set(keyOf(stock), stock);

        return stock.reverse(
          original,
          { type: document.type, id: document.id, lineId: original.origin.lineId },
          MovementId.of(this.ids.next()),
          now,
        );
      });

    return { stocks: [...touched.values()], movements };
  }
}

// El documento se valido contra el maestro de articulos antes de bloquear nada: si entretanto el articulo se
// desactivo o se volvio servicio, no mueve existencia. Tampoco al anular: devolveria mercancia a
// un articulo que ya no se ofrece, o la sacaria de uno que no puede tenerla.
function ensureMovable(ledger: Ledger, itemId: ItemRef): void {
  const item = ledger.item(itemId);

  if (!item.isActive) throw new InactiveStockItemError(itemId.value);
  if (item.type === 'service') throw new ServiceHasNoStockError(itemId.value);
}

// Por articulo Y bodega: un documento podria tocar el mismo articulo en dos bodegas.
function keyOf(stock: ItemStock): string {
  return `${stock.itemId.value}|${stock.warehouseId.value}`;
}
