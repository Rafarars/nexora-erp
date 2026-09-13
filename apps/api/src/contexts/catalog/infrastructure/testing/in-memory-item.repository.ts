import { ensureUniqueCode } from './unique-code.js';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { DuplicateSkuError } from '../../domain/errors/duplicate.errors.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { Item, ItemPrimitives } from '../../domain/item/item.entity.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { Sku } from '../../domain/item/sku.vo.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';

export class InMemoryItemRepository implements ItemRepository {
  private readonly rows = new Map<string, ItemPrimitives>();

  constructor(seed: Item[] = []) {
    seed.forEach((item) => this.rows.set(item.id.value, item.toPrimitives()));
  }

  async save(item: Item): Promise<void> {
    const row = item.toPrimitives();
    ensureUniqueCode([...this.rows.values()], row);
    const clash = [...this.rows.values()].find(
      (other) => other.id !== row.id && other.tenantId === row.tenantId && other.sku === row.sku,
    );

    if (clash) throw new DuplicateSkuError(row.sku, row.tenantId);

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

  async searchByTenant(tenantId: TenantId): Promise<Item[]> {
    return this.ofTenant(tenantId).map((row) => Item.fromPrimitives(row));
  }

  async hasActiveWithCategory(tenantId: TenantId, categoryId: CategoryId): Promise<boolean> {
    return this.ofTenant(tenantId).some((row) => row.isActive && row.categoryId === categoryId.value);
  }

  async hasActiveWithTax(tenantId: TenantId, taxId: TaxId): Promise<boolean> {
    return this.ofTenant(tenantId).some((row) => row.isActive && row.taxId === taxId.value);
  }

  async hasActiveWithUnit(tenantId: TenantId, unitId: MeasurementUnitId): Promise<boolean> {
    return this.ofTenant(tenantId).some(
      (row) => row.isActive && row.units.some((unit) => unit.unitId === unitId.value),
    );
  }

  private ofTenant(tenantId: TenantId): ItemPrimitives[] {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
