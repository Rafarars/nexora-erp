import { AdjustmentRepository } from '../domain/adjustment/adjustment.repository.js';
import { AdjustmentPosting } from '../domain/adjustment/posting/adjustment-posting.js';
import { InventoryCodeSequence } from '../domain/shared/code-sequence.js';
import { StockRepository } from '../domain/stock/stock.repository.js';

import { DocumentAuthors } from '../domain/documents/document-authors.js';

export interface InventoryPorts {
  adjustments: AdjustmentRepository;
  stocks: StockRepository;
  posting: AdjustmentPosting;
  authors: DocumentAuthors;
  codes: InventoryCodeSequence;
}

// Deja vacio el inventario y garantiza que existen las empresas, articulos, unidades y
// bodegas del object mother: sin ellos la base rechazaria cada fila.
export interface InventoryPortsHarness {
  ports(): InventoryPorts;
  // Desactiva un articulo sembrado, como lo haria su maestro.
  deactivateItem(itemId: string): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}
