import { CategoryRepository } from '../domain/category/category.repository.js';
import { ItemPosting } from '../domain/item/posting/item-posting.js';
import { ItemRepository } from '../domain/item/item.repository.js';
import { MeasurementUnitRepository } from '../domain/measurement-unit/measurement-unit.repository.js';
import { CodeSequence } from '../domain/shared/code-sequence.js';
import { TaxRepository } from '../domain/tax/tax.repository.js';
import { WarehouseRepository } from '../domain/warehouse/warehouse.repository.js';

export interface CatalogRepositories {
  categories: CategoryRepository;
  units: MeasurementUnitRepository;
  taxes: TaxRepository;
  warehouses: WarehouseRepository;
  items: ItemRepository;
  itemPosting: ItemPosting;
  codes: CodeSequence;
}

export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
export type SalesOrderStatus = 'draft' | 'confirmed' | 'partially_dispatched' | 'dispatched' | 'cancelled';

// Lo que un articulo compromete fuera del catalogo, sembrado en la empresa A y su bodega A. Cada
// implementacion lo escribe a su manera: la base en las tablas de inventario, compras y ventas.
export interface ItemCommitmentsSeeder {
  stock(itemId: string, quantity: number): Promise<void>;
  movement(itemId: string): Promise<void>;
  purchaseLine(line: { itemId: string; unitId: string; status: PurchaseOrderStatus; quantity: number; received: number }): Promise<void>;
  salesLine(line: { itemId: string; unitId: string; status: SalesOrderStatus; quantity: number; dispatched: number }): Promise<void>;
}

// Lo unico que cada implementacion hace distinto: entregar los repositorios, sembrar lo que un
// articulo comprometio y dejar el catalogo vacio, con las dos empresas de prueba existiendo.
export interface CatalogRepositoriesHarness {
  repositories(): CatalogRepositories;
  commitments(): ItemCommitmentsSeeder;
  reset(): Promise<void>;
  close(): Promise<void>;
}
