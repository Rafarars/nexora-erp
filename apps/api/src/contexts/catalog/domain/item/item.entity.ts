import { CategoryId } from '../category/category-id.vo.js';
import { MeasurementUnitId } from '../measurement-unit/measurement-unit-id.vo.js';
import { optionalText } from '../shared/bounded-text.vo.js';
import { CatalogCode, CodePrefix } from '../shared/catalog-code.vo.js';
import { CatalogRecord, CatalogRecordPrimitives } from '../shared/catalog-record.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { TaxId } from '../tax/tax-id.vo.js';
import { ItemId } from './item-id.vo.js';
import { ItemName } from './item-name.vo.js';
import { ItemUnitPrimitives, ItemUnits } from './item-units.js';
import { ItemType } from './item-type.js';
import { Sku } from './sku.vo.js';

export interface ItemPrimitives extends CatalogRecordPrimitives {
  sku: string;
  name: string;
  description: string | null;
  type: ItemType;
  categoryId: string | null;
  taxId: string | null;
  units: ItemUnitPrimitives[];
}

// Lo que una persona decide de un articulo, igual al crearlo y al editarlo.
export interface ItemDetails {
  sku: Sku;
  name: ItemName;
  description: string | null;
  type: ItemType;
  categoryId: CategoryId | null;
  taxId: TaxId | null;
  units: ItemUnits;
}

const DESCRIPTION_MAX = 1000;

export class Item extends CatalogRecord<ItemId> {
  static readonly CODE_PREFIX: CodePrefix = 'ART';

  private constructor(
    id: ItemId,
    tenantId: TenantId,
    code: CatalogCode,
    private details: ItemDetails,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id, tenantId, code, active, createdAt, updatedAt);
  }

  static create(id: ItemId, tenantId: TenantId, code: CatalogCode, details: ItemDetails, now: Date): Item {
    return new Item(id, tenantId, code, normalized(details), true, now, now);
  }

  static fromPrimitives(row: ItemPrimitives): Item {
    return new Item(
      ItemId.of(row.id),
      TenantId.of(row.tenantId),
      CatalogCode.of(row.code),
      {
        sku: Sku.of(row.sku),
        name: ItemName.of(row.name),
        description: row.description,
        type: row.type,
        categoryId: row.categoryId ? CategoryId.of(row.categoryId) : null,
        taxId: row.taxId ? TaxId.of(row.taxId) : null,
        units: ItemUnits.fromPrimitives(row.units),
      },
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }

  toPrimitives(): ItemPrimitives {
    const { sku, name, description, type, categoryId, taxId, units } = this.details;

    return {
      ...this.recordPrimitives(),
      sku: sku.value,
      name: name.value,
      description,
      type,
      categoryId: categoryId?.value ?? null,
      taxId: taxId?.value ?? null,
      units: units.toPrimitives(),
    };
  }

  update(details: ItemDetails, now: Date): void {
    this.details = normalized(details);
    this.touch(now);
  }

  // Lo que el kardex no tolera que cambie: la unidad en la que guarda las cantidades y si el
  // articulo tiene existencia o no.
  changesStockIdentity(details: ItemDetails): boolean {
    return (
      details.type !== this.details.type || !details.units.base().unitId.equals(this.details.units.base().unitId)
    );
  }

  sku(): Sku {
    return this.details.sku;
  }

  categoryId(): CategoryId | null {
    return this.details.categoryId;
  }

  taxId(): TaxId | null {
    return this.details.taxId;
  }

  unitIds(): MeasurementUnitId[] {
    return this.details.units.unitIds();
  }

  usesCategory(id: CategoryId): boolean {
    return this.details.categoryId?.equals(id) ?? false;
  }

  usesTax(id: TaxId): boolean {
    return this.details.taxId?.equals(id) ?? false;
  }

  usesUnit(id: MeasurementUnitId): boolean {
    return this.details.units.uses(id);
  }
}

function normalized(details: ItemDetails): ItemDetails {
  return { ...details, description: optionalText(details.description, DESCRIPTION_MAX, 'ItemDescription') };
}
