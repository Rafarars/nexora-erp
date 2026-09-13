import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { AdjustmentFinder } from '../../domain/adjustment/find/adjustment-finder.js';
import { AdjustmentLineFactory } from '../../domain/adjustment/lines/adjustment-line-factory.js';
import { AdjustmentCancellation } from '../../domain/adjustment/posting/adjustment-cancellation.js';
import { AdjustmentConfirmation } from '../../domain/adjustment/posting/adjustment-confirmation.js';
import { StockMovements } from '../../domain/stock/posting/stock-movements.js';
import { NOW, stockWarehouses, stockableItems } from '../../domain/testing/inventory.mother.js';
import { InMemoryInventoryCatalog } from '../../infrastructure/testing/in-memory-inventory-catalog.js';
import { InMemoryInventoryCodeSequence } from '../../infrastructure/testing/in-memory-inventory-code-sequence.js';
import { InMemoryInventoryStore } from '../../infrastructure/testing/in-memory-inventory-store.js';
import { InMemoryMovementDocuments } from '../../infrastructure/testing/in-memory-movement-documents.js';

// El mundo de una prueba de aplicacion del inventario: catalogo sembrado, almacen vacio y
// reloj congelado. Sin base de datos ni NestJS.
export function anInventoryScenario() {
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator();
  const store = new InMemoryInventoryStore(() => clock.now());
  const catalog = new InMemoryInventoryCatalog(stockableItems(), stockWarehouses());

  return {
    clock,
    ids,
    store,
    catalog,
    documents: new InMemoryMovementDocuments(store),
    codes: new InMemoryInventoryCodeSequence(),
    finder: new AdjustmentFinder(store),
    factory: new AdjustmentLineFactory(catalog, ids),
    confirmation: new AdjustmentConfirmation(new StockMovements(ids)),
    cancellation: new AdjustmentCancellation(new StockMovements(ids)),
  };
}

export type InventoryScenario = ReturnType<typeof anInventoryScenario>;
