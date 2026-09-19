import { CategoryId } from '../category/category-id.vo.js';
import { CategoryName } from '../category/category-name.vo.js';
import { Category } from '../category/category.entity.js';
import { MeasurementUnitId } from '../measurement-unit/measurement-unit-id.vo.js';
import { MeasurementUnitName } from '../measurement-unit/measurement-unit-name.vo.js';
import { MeasurementUnit } from '../measurement-unit/measurement-unit.entity.js';
import { UnitAbbreviation } from '../measurement-unit/unit-abbreviation.vo.js';
import { PriceListId } from '../price-list/price-list-id.vo.js';
import { PriceListName } from '../price-list/price-list-name.vo.js';
import { PriceList } from '../price-list/price-list.entity.js';
import { CatalogCode } from '../shared/catalog-code.vo.js';
import { CurrencyCode } from '../shared/currency-code.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { TaxId } from '../tax/tax-id.vo.js';
import { TaxName } from '../tax/tax-name.vo.js';
import { TaxRate } from '../tax/tax-rate.vo.js';
import { Tax } from '../tax/tax.entity.js';
import { WarehouseId } from '../warehouse/warehouse-id.vo.js';
import { WarehouseName } from '../warehouse/warehouse-name.vo.js';
import { Warehouse } from '../warehouse/warehouse.entity.js';

// Object mothers del catalogo: cada prueba dice solo lo que le importa. Los mismos
// identificadores de empresa que en access, porque hablan de las mismas empresas.
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
export const PRICE_LIST_A = 'a1111111-1111-4111-8111-111111111111';
export const PRICE_LIST_B = 'a2222222-2222-4222-8222-222222222222';
export const WAREHOUSE_A = 'b1111111-1111-4111-8111-111111111111';
export const WAREHOUSE_B = 'b2222222-2222-4222-8222-222222222222';

export function aCategory(
  overrides: { id?: string; tenantId?: string; code?: string; name?: string; active?: boolean } = {},
): Category {
  const category = Category.create(
    CategoryId.of(overrides.id ?? CATEGORY_A),
    TenantId.of(overrides.tenantId ?? TENANT_A),
    CatalogCode.of(overrides.code ?? 'CAT000001'),
    CategoryName.of(overrides.name ?? 'Bebidas'),
    null,
    NOW,
  );

  if (overrides.active === false) category.deactivate(NOW);

  return category;
}

export function aUnit(
  overrides: {
    id?: string;
    tenantId?: string;
    code?: string;
    name?: string;
    abbreviation?: string;
    mustBeWhole?: boolean;
    active?: boolean;
  } = {},
): MeasurementUnit {
  const unit = MeasurementUnit.create(
    MeasurementUnitId.of(overrides.id ?? UNIT_PIECE),
    TenantId.of(overrides.tenantId ?? TENANT_A),
    CatalogCode.of(overrides.code ?? 'UOM000001'),
    MeasurementUnitName.of(overrides.name ?? 'Unidad'),
    UnitAbbreviation.of(overrides.abbreviation ?? 'un'),
    overrides.mustBeWhole ?? false,
    NOW,
  );

  if (overrides.active === false) unit.deactivate(NOW);

  return unit;
}

export function aTax(
  overrides: { id?: string; tenantId?: string; code?: string; name?: string; rate?: number; active?: boolean } = {},
): Tax {
  const tax = Tax.create(
    TaxId.of(overrides.id ?? TAX_A),
    TenantId.of(overrides.tenantId ?? TENANT_A),
    CatalogCode.of(overrides.code ?? 'IMP000001'),
    TaxName.of(overrides.name ?? 'IVA 16%'),
    TaxRate.of(overrides.rate ?? 16),
    NOW,
  );

  if (overrides.active === false) tax.deactivate(NOW);

  return tax;
}

export function aWarehouse(
  overrides: {
    id?: string;
    tenantId?: string;
    code?: string;
    name?: string;
    isDefault?: boolean;
    active?: boolean;
  } = {},
): Warehouse {
  const warehouse = Warehouse.create(
    WarehouseId.of(overrides.id ?? WAREHOUSE_A),
    TenantId.of(overrides.tenantId ?? TENANT_A),
    CatalogCode.of(overrides.code ?? 'BOD000001'),
    WarehouseName.of(overrides.name ?? 'Principal'),
    null,
    NOW,
  );

  if (overrides.isDefault) warehouse.markAsDefault(NOW);
  if (overrides.active === false) warehouse.deactivate(NOW);

  return warehouse;
}

export function aPriceList(
  overrides: {
    id?: string;
    tenantId?: string;
    code?: string;
    name?: string;
    currency?: string;
    isDefault?: boolean;
    active?: boolean;
  } = {},
): PriceList {
  const priceList = PriceList.create(
    PriceListId.of(overrides.id ?? PRICE_LIST_A),
    TenantId.of(overrides.tenantId ?? TENANT_A),
    CatalogCode.of(overrides.code ?? 'LPR000001'),
    PriceListName.of(overrides.name ?? 'Mayorista'),
    null,
    CurrencyCode.of(overrides.currency ?? 'USD'),
    NOW,
  );

  if (overrides.isDefault) priceList.markAsDefault(NOW);
  if (overrides.active === false) priceList.deactivate(NOW);

  return priceList;
}
