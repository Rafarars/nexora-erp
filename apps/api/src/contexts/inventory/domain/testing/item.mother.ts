import { ItemReorderRules } from '../item/item-reorder-rules.js';
import { Barcode } from '../item/barcode.vo.js';
import { ReferencedCategory, ReferencedTax, ReferencedUnit } from '../catalog/catalog-references.js';
import { ItemCode } from '../item/item-code.vo.js';
import { ItemId } from '../item/item-id.vo.js';
import { ItemName } from '../item/item-name.vo.js';
import { ItemUnit, ItemUnits } from '../item/item-units.js';
import { ItemType } from '../item/item-type.js';
import { Item } from '../item/item.entity.js';
import { Sku } from '../item/sku.vo.js';
import { CategoryRef, TaxRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

// Object mothers del maestro de articulos. Los mismos identificadores que en el catalogo, porque
// hablan de las mismas categorias, impuestos y unidades.
export const NOW = new Date('2026-01-15T10:00:00.000Z');
export const LATER = new Date('2026-01-16T10:00:00.000Z');

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

export const CATEGORY_A = 'c1111111-1111-4111-8111-111111111111';
export const CATEGORY_B = 'c2222222-2222-4222-8222-222222222222';
export const UNIT_PIECE = 'e1111111-1111-4111-8111-111111111111';
export const UNIT_BOX = 'e2222222-2222-4222-8222-222222222222';
export const UNIT_KILO = 'e3333333-3333-4333-8333-333333333333';
export const TAX_A = 'f1111111-1111-4111-8111-111111111111';
export const TAX_B = 'f2222222-2222-4222-8222-222222222222';
export const WAREHOUSE_A = 'b1111111-1111-4111-8111-111111111111';
export const WAREHOUSE_B = 'b2222222-2222-4222-8222-222222222222';
export const ITEM_A = 'a1111111-1111-4111-8111-111111111111';
export const ITEM_B = 'a2222222-2222-4222-8222-222222222222';

type OfTenant<T> = T & { tenantId: string };

export function aCategory(
  overrides: { id?: string; tenantId?: string; name?: string; active?: boolean } = {},
): OfTenant<ReferencedCategory> {
  return {
    tenantId: overrides.tenantId ?? TENANT_A,
    id: overrides.id ?? CATEGORY_A,
    name: overrides.name ?? 'Bebidas',
    isActive: overrides.active ?? true,
  };
}

export function aTax(
  overrides: { id?: string; tenantId?: string; name?: string; rate?: number; active?: boolean } = {},
): OfTenant<ReferencedTax> {
  return {
    tenantId: overrides.tenantId ?? TENANT_A,
    id: overrides.id ?? TAX_A,
    name: overrides.name ?? 'IVA 16%',
    rate: overrides.rate ?? 16,
    isActive: overrides.active ?? true,
  };
}

export function aUnit(
  overrides: { id?: string; tenantId?: string; name?: string; abbreviation?: string; active?: boolean } = {},
): OfTenant<ReferencedUnit> {
  return {
    tenantId: overrides.tenantId ?? TENANT_A,
    id: overrides.id ?? UNIT_PIECE,
    name: overrides.name ?? 'Unidad',
    abbreviation: overrides.abbreviation ?? 'un',
    isActive: overrides.active ?? true,
  };
}

export function baseUnitOnly(unitId = UNIT_PIECE): ItemUnits {
  return ItemUnits.of([ItemUnit.of(unitId, 1, true)]);
}

export function anItem(
  overrides: {
    id?: string;
    tenantId?: string;
    code?: string;
    sku?: string;
    barcode?: string | null;
    isPurchasable?: boolean;
    isSellable?: boolean;
    name?: string;
    type?: ItemType;
    categoryId?: string | null;
    salesTaxId?: string | null;
    purchaseTaxId?: string | null;
    units?: ItemUnits;
    reorderRules?: ItemReorderRules;
    active?: boolean;
  } = {},
): Item {
  const item = Item.create(
    ItemId.of(overrides.id ?? ITEM_A),
    TenantId.of(overrides.tenantId ?? TENANT_A),
    ItemCode.of(overrides.code ?? 'ART000001'),
    {
      sku: Sku.of(overrides.sku ?? 'AGUA-500'),
      barcode: overrides.barcode ? Barcode.of(overrides.barcode) : null,
      isPurchasable: overrides.isPurchasable ?? true,
      isSellable: overrides.isSellable ?? true,
      name: ItemName.of(overrides.name ?? 'Agua mineral 500 ml'),
      description: null,
      type: overrides.type ?? 'inventoried',
      categoryId: overrides.categoryId === null ? null : CategoryRef.of(overrides.categoryId ?? CATEGORY_A),
      salesTaxId: overrides.salesTaxId === null ? null : TaxRef.of(overrides.salesTaxId ?? TAX_A),
      purchaseTaxId: overrides.purchaseTaxId === null ? null : TaxRef.of(overrides.purchaseTaxId ?? TAX_A),
      units: overrides.units ?? baseUnitOnly(),
      reorderRules: overrides.reorderRules ?? ItemReorderRules.none(),
    },
    NOW,
  );

  if (overrides.active === false) item.deactivate(NOW);

  return item;
}
