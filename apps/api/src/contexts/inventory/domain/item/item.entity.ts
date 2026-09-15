import { optionalText } from '../shared/bounded-text.vo.js';
import { CategoryRef, TaxRef, UnitRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { ItemCode } from './item-code.vo.js';
import { ItemId } from './item-id.vo.js';
import { ItemName } from './item-name.vo.js';
import { ItemUnitPrimitives, ItemUnits } from './item-units.js';
import { ItemType } from './item-type.js';
import { Sku } from './sku.vo.js';

export interface ItemPrimitives {
  id: string;
  tenantId: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  categoryId: CategoryRef | null;
  taxId: TaxRef | null;
  units: ItemUnits;
}

const DESCRIPTION_MAX = 1000;

// El maestro del articulo. Nada lo borra: se desactiva y se reactiva.
export class Item {
  private constructor(
    readonly id: ItemId,
    readonly tenantId: TenantId,
    readonly code: ItemCode,
    private details: ItemDetails,
    private active: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(id: ItemId, tenantId: TenantId, code: ItemCode, details: ItemDetails, now: Date): Item {
    return new Item(id, tenantId, code, normalized(details), true, now, now);
  }

  static fromPrimitives(row: ItemPrimitives): Item {
    return new Item(
      ItemId.of(row.id),
      TenantId.of(row.tenantId),
      ItemCode.of(row.code),
      {
        sku: Sku.of(row.sku),
        name: ItemName.of(row.name),
        description: row.description,
        type: row.type,
        categoryId: row.categoryId ? CategoryRef.of(row.categoryId) : null,
        taxId: row.taxId ? TaxRef.of(row.taxId) : null,
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
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code.value,
      isActive: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      sku: sku.value,
      name: name.value,
      description,
      type,
      categoryId: categoryId?.value ?? null,
      taxId: taxId?.value ?? null,
      units: units.toPrimitives(),
    };
  }

  isActive(): boolean {
    return this.active;
  }

  deactivate(now: Date): void {
    this.active = false;
    this.updatedAt = now;
  }

  activate(now: Date): void {
    this.active = true;
    this.updatedAt = now;
  }

  update(details: ItemDetails, now: Date): void {
    this.details = normalized(details);
    this.updatedAt = now;
  }

  // Lo que el kardex no tolera que cambie: la unidad en la que guarda las cantidades y si el
  // articulo tiene existencia o no.
  changesStockIdentity(details: ItemDetails): boolean {
    return (
      details.type !== this.details.type || !details.units.base().unitId.equals(this.details.units.base().unitId)
    );
  }

  // Cierto si con los datos nuevos la unidad sigue en el articulo y con el mismo factor.
  keepsUnit(details: ItemDetails, unitId: UnitRef): boolean {
    const current = this.details.units.factorOf(unitId);

    return current !== null && details.units.factorOf(unitId) === current;
  }

  sku(): Sku {
    return this.details.sku;
  }

  categoryId(): CategoryRef | null {
    return this.details.categoryId;
  }

  taxId(): TaxRef | null {
    return this.details.taxId;
  }

  unitIds(): UnitRef[] {
    return this.details.units.unitIds();
  }

  usesCategory(id: CategoryRef): boolean {
    return this.details.categoryId?.equals(id) ?? false;
  }

  usesTax(id: TaxRef): boolean {
    return this.details.taxId?.equals(id) ?? false;
  }

  usesUnit(id: UnitRef): boolean {
    return this.details.units.uses(id);
  }
}

function normalized(details: ItemDetails): ItemDetails {
  return { ...details, description: optionalText(details.description, DESCRIPTION_MAX, 'ItemDescription') };
}
