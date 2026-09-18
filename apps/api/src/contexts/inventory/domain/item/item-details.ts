import { CategoryRef, TaxRef } from '../shared/references.vo.js';
import { Barcode } from './barcode.vo.js';
import { ItemDetails } from './item.entity.js';
import { ItemName } from './item-name.vo.js';
import { ItemPricePrimitives, ItemPrices } from './item-prices.js';
import { ItemReorderRules } from './item-reorder-rules.js';
import { SalePrice } from './sale-price.vo.js';
import { ItemUnitPrimitives, ItemUnits } from './item-units.js';
import { itemTypeOf } from './item-type.js';
import { Sku } from './sku.vo.js';

export interface ItemDetailsInput {
  sku: string;
  barcode?: string | null;
  name: string;
  isPurchasable?: boolean;
  isSellable?: boolean;
  description?: string | null;
  type: string;
  categoryId?: string | null;
  salesTaxId?: string | null;
  purchaseTaxId?: string | null;
  units: ItemUnitPrimitives[];
  reorderRules?: { warehouseId: string; minQuantity: number; maxQuantity?: number | null; reorderQuantity: number }[];
  prices?: ItemPricePrimitives[];
  minPrice?: number | null;
}

// Crear y editar reciben lo mismo: se valida en un solo sitio, y cualquier valor
// invalido se rechaza antes de consultar nada.
export function itemDetailsOf(input: ItemDetailsInput): ItemDetails {
  return {
    sku: Sku.of(input.sku),
    barcode: input.barcode ? Barcode.of(input.barcode) : null,
    name: ItemName.of(input.name),
    // Por defecto se compra y se vende: lo raro es el articulo que solo sirve para una cosa.
    isPurchasable: input.isPurchasable ?? true,
    isSellable: input.isSellable ?? true,
    description: input.description ?? null,
    type: itemTypeOf(input.type),
    categoryId: input.categoryId ? CategoryRef.of(input.categoryId) : null,
    salesTaxId: input.salesTaxId ? TaxRef.of(input.salesTaxId) : null,
    purchaseTaxId: input.purchaseTaxId ? TaxRef.of(input.purchaseTaxId) : null,
    units: ItemUnits.fromPrimitives(input.units),
    reorderRules: ItemReorderRules.fromPrimitives((input.reorderRules ?? []).map((rule) => ({ ...rule, maxQuantity: rule.maxQuantity ?? null }))),
    prices: ItemPrices.fromPrimitives(input.prices ?? []),
    minPrice: input.minPrice === null || input.minPrice === undefined ? null : SalePrice.of(input.minPrice),
  };
}
