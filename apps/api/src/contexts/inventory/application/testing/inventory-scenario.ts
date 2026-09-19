import { ClockBusinessCalendar } from '../../../../shared/infrastructure/testing/clock-business-calendar.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { AdjustmentFinder } from '../../domain/adjustment/find/adjustment-finder.js';
import { AdjustmentLineFactory } from '../../domain/adjustment/lines/adjustment-line-factory.js';
import { AdjustmentCancellation } from '../../domain/adjustment/posting/adjustment-cancellation.js';
import { AdjustmentConfirmation } from '../../domain/adjustment/posting/adjustment-confirmation.js';
import { StockMovements } from '../../domain/stock/posting/stock-movements.js';
import { NOW, TENANT_A, stockWarehouses, stockableItems } from '../../domain/testing/inventory.mother.js';
import { InMemoryInventoryCatalog } from '../../infrastructure/testing/in-memory-inventory-catalog.js';
import { InMemoryInventoryCodeSequence } from '../../infrastructure/testing/in-memory-inventory-code-sequence.js';
import { InMemoryInventoryStore } from '../../infrastructure/testing/in-memory-inventory-store.js';
import { FixedDocumentRates } from '../../../../shared/infrastructure/testing/fixed-document-rates.js';
import { InMemoryDocumentAuthors } from '../../infrastructure/testing/in-memory-document-authors.js';
import { InMemoryExpectedStock } from '../../infrastructure/testing/in-memory-expected-stock.js';
import { InMemoryMovementDocuments } from '../../infrastructure/testing/in-memory-movement-documents.js';

// Quien registra en las pruebas de aplicacion.
export const ANA = '99999999-9999-4999-8999-999999999999';

// El mundo de una prueba de aplicacion del inventario: catalogo sembrado, almacen vacio y
// reloj congelado. Sin base de datos ni NestJS.
export function anInventoryScenario() {
  const clock = new FixedClock(NOW);
  const calendar = new ClockBusinessCalendar(clock);
  const ids = new SequentialIdGenerator();
  const catalog = new InMemoryInventoryCatalog(stockableItems(), stockWarehouses());
  const store = new InMemoryInventoryStore(catalog, () => clock.now());

  return {
    clock,
    calendar,
    ids,
    store,
    catalog,
    documents: new InMemoryMovementDocuments(store),
    expected: new InMemoryExpectedStock(),
    rates: new FixedDocumentRates(),
    authors: new InMemoryDocumentAuthors([{ tenantId: TENANT_A, id: ANA, name: 'Ana Rivas' }]),
    codes: new InMemoryInventoryCodeSequence(),
    finder: new AdjustmentFinder(store),
    factory: new AdjustmentLineFactory(catalog, ids),
    confirmation: new AdjustmentConfirmation(new StockMovements(ids)),
    cancellation: new AdjustmentCancellation(new StockMovements(ids)),
  };
}

export type InventoryScenario = ReturnType<typeof anInventoryScenario>;
