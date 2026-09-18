import { Barcode } from './barcode.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { ItemId } from './item-id.vo.js';
import { Item } from './item.entity.js';
import { Sku } from './sku.vo.js';

export const ITEM_REPOSITORY = Symbol('ItemRepository');

// Lo que el listado admite: un texto libre y una pagina.
export interface ItemCriteria {
  text: string | null;
  limit: number;
  offset: number;
}

export interface ItemRepository {
  // Lanza DuplicateSkuError si la base rechaza el SKU.
  save(item: Item): Promise<void>;
  find(tenantId: TenantId, id: ItemId): Promise<Item | null>;
  findBySku(tenantId: TenantId, sku: Sku): Promise<Item | null>;
  findByBarcode(tenantId: TenantId, barcode: Barcode): Promise<Item | null>;
  // Una pagina del maestro, filtrada por texto: `total` es cuantos cumplen el filtro.
  search(tenantId: TenantId, criteria: ItemCriteria): Promise<{ items: Item[]; total: number }>;
  // Los que tienen alguna regla de reposicion: es lo que mira el listado de bajo minimo.
  withReorderRules(tenantId: TenantId): Promise<Item[]>;
}
