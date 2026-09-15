import { CatalogReferences, ReferencedCategory, ReferencedTax, ReferencedUnit } from '../domain/catalog/catalog-references.js';
import { ItemPosting } from '../domain/item/posting/item-posting.js';
import { ItemRepository } from '../domain/item/item.repository.js';

export interface ItemPorts {
  items: ItemRepository;
  posting: ItemPosting;
  catalog: CatalogReferences;
}

type OfTenant<T> = T & { tenantId: string };

// Lo que el catalogo tiene y el articulo usa. La base exige las filas detras de cada articulo.
export interface CatalogSeeder {
  category(row: OfTenant<ReferencedCategory>): Promise<void>;
  tax(row: OfTenant<ReferencedTax>): Promise<void>;
  unit(row: OfTenant<ReferencedUnit>): Promise<void>;
}

export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
export type SalesOrderStatus = 'draft' | 'confirmed' | 'partially_dispatched' | 'dispatched' | 'cancelled';

// Lo que un articulo compromete en existencias, kardex y documentos, sembrado en la empresa A y
// su bodega A. Cada implementacion lo escribe a su manera: la base en las tablas de inventario,
// compras y ventas.
export interface ItemCommitmentsSeeder {
  stock(itemId: string, quantity: number): Promise<void>;
  movement(itemId: string): Promise<void>;
  purchaseLine(line: { itemId: string; unitId: string; status: PurchaseOrderStatus; quantity: number; received: number }): Promise<void>;
  salesLine(line: { itemId: string; unitId: string; status: SalesOrderStatus; quantity: number; dispatched: number }): Promise<void>;
}

// Lo unico que cada implementacion hace distinto: entregar los puertos, sembrar el catalogo y lo
// comprometido, y dejarlo todo vacio con las dos empresas de prueba existiendo.
export interface ItemPortsHarness {
  ports(): ItemPorts;
  catalog(): CatalogSeeder;
  commitments(): ItemCommitmentsSeeder;
  reset(): Promise<void>;
  close(): Promise<void>;
}
