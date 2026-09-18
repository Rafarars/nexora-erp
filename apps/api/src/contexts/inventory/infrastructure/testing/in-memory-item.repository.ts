import { DuplicateSkuError } from '../../domain/errors/item.errors.js';
import { Barcode } from '../../domain/item/barcode.vo.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { Item, ItemPrimitives } from '../../domain/item/item.entity.js';
import { ItemCriteria, ItemRepository } from '../../domain/item/item.repository.js';
import { Sku } from '../../domain/item/sku.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryItemRepository implements ItemRepository {
  private readonly rows = new Map<string, ItemPrimitives>();

  constructor(seed: Item[] = []) {
    seed.forEach((item) => this.rows.set(item.id.value, item.toPrimitives()));
  }

  async save(item: Item): Promise<void> {
    const row = item.toPrimitives();
    const others = [...this.rows.values()].filter((other) => other.id !== row.id && other.tenantId === row.tenantId);

    // La base rechaza dos articulos con el mismo codigo en una empresa: el doble tambien, o una
    // prueba que reutiliza un codigo pasaria en memoria y fallaria contra PostgreSQL.
    if (others.some((other) => other.code === row.code)) {
      throw new Error(`Code <${row.code}> already exists in tenant <${row.tenantId}>.`);
    }

    if (others.some((other) => other.sku === row.sku)) throw new DuplicateSkuError(row.sku, row.tenantId);

    this.rows.set(row.id, structuredClone(row));
  }

  async find(tenantId: TenantId, id: ItemId): Promise<Item | null> {
    const row = this.rows.get(id.value);

    return row && row.tenantId === tenantId.value ? Item.fromPrimitives(row) : null;
  }

  async findBySku(tenantId: TenantId, sku: Sku): Promise<Item | null> {
    const row = this.ofTenant(tenantId).find((candidate) => candidate.sku === sku.value);

    return row ? Item.fromPrimitives(row) : null;
  }

  async findByBarcode(tenantId: TenantId, barcode: Barcode): Promise<Item | null> {
    const row = this.ofTenant(tenantId).find((candidate) => candidate.barcode === barcode.value);

    return row ? Item.fromPrimitives(row) : null;
  }

  // Filtra y pagina como la base: por codigo, SKU, nombre o codigo de barras, sin distinguir
  // mayusculas, y en orden de nombre.
  async withReorderRules(tenantId: TenantId): Promise<Item[]> {
    return this.ofTenant(tenantId)
      .filter((row) => row.reorderRules.length > 0)
      .map((row) => Item.fromPrimitives(row));
  }

  async search(tenantId: TenantId, criteria: ItemCriteria): Promise<{ items: Item[]; total: number }> {
    const text = criteria.text?.toLowerCase();
    const matches = this.ofTenant(tenantId).filter(
      (row) => !text || [row.code, row.sku, row.name, row.barcode ?? ''].some((value) => value.toLowerCase().includes(text)),
    );

    return {
      items: matches.slice(criteria.offset, criteria.offset + criteria.limit).map((row) => Item.fromPrimitives(row)),
      total: matches.length,
    };
  }

  private ofTenant(tenantId: TenantId): ItemPrimitives[] {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
