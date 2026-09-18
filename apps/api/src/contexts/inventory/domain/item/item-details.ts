import { CategoryRef, TaxRef } from '../shared/references.vo.js';
import { ItemDetails } from './item.entity.js';
import { ItemName } from './item-name.vo.js';
import { ItemUnitPrimitives, ItemUnits } from './item-units.js';
import { itemTypeOf } from './item-type.js';
import { Sku } from './sku.vo.js';

export interface ItemDetailsInput {
  sku: string;
  name: string;
  description?: string | null;
  type: string;
  categoryId?: string | null;
  salesTaxId?: string | null;
  purchaseTaxId?: string | null;
  units: ItemUnitPrimitives[];
}

// Crear y editar reciben lo mismo: se valida en un solo sitio, y cualquier valor
// invalido se rechaza antes de consultar nada.
export function itemDetailsOf(input: ItemDetailsInput): ItemDetails {
  return {
    sku: Sku.of(input.sku),
    name: ItemName.of(input.name),
    description: input.description ?? null,
    type: itemTypeOf(input.type),
    categoryId: input.categoryId ? CategoryRef.of(input.categoryId) : null,
    salesTaxId: input.salesTaxId ? TaxRef.of(input.salesTaxId) : null,
    purchaseTaxId: input.purchaseTaxId ? TaxRef.of(input.purchaseTaxId) : null,
    units: ItemUnits.fromPrimitives(input.units),
  };
}
