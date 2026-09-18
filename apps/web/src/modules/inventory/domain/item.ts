import { formatNumber } from '../../catalog/domain/catalog';
import type { CatalogRecord } from '../../catalog/domain/catalog';

// El articulo tal como lo usa la interfaz. Vive en el inventario y apunta a la categoria, el
// impuesto y las unidades del catalogo.
export type ItemType = 'inventoried' | 'service';

export interface ItemUnit {
  unitId: string;
  name: string;
  abbreviation: string;
  conversionFactor: number;
  isBase: boolean;
}

export interface Item extends CatalogRecord {
  sku: string;
  description: string | null;
  type: ItemType;
  category: { id: string; name: string } | null;
  barcode: string | null;
  isPurchasable: boolean;
  isSellable: boolean;
  // Cuanto se quiere tener en cada bodega; vacio, no se vigila.
  reorderRules: { warehouse: { id: string; name: string }; minQuantity: number; maxQuantity: number | null; reorderQuantity: number }[];
  // Lo que cuesta en cada lista, en la unidad base; vacio, no se sugiere precio al venderlo.
  prices: { priceList: { id: string; name: string; currency: string }; price: number }[];
  // Piso de venta en la moneda de la empresa; nulo, no hay piso.
  minPrice: number | null;
  // El que se copia al vender y el que se copia al comprar.
  salesTax: { id: string; name: string; rate: number } | null;
  purchaseTax: { id: string; name: string; rate: number } | null;
  units: ItemUnit[];
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  inventoried: 'Inventariado',
  service: 'Servicio',
};

// "1 cja = 24 un": como se lee una equivalencia en un almacen.
export function describeUnits(units: ItemUnit[]): string {
  const base = units.find((unit) => unit.isBase);

  if (!base) return '';

  const others = units
    .filter((unit) => !unit.isBase)
    .map((unit) => `1 ${unit.abbreviation} = ${formatNumber(unit.conversionFactor)} ${base.abbreviation}`);

  return [base.abbreviation, ...others].join(' · ');
}


// Lo que la pantalla puede sugerir sin preguntar al servidor: el precio de la lista por la unidad
// elegida. Si la lista esta en otra moneda que el documento, no se sugiere nada y el campo queda
// en blanco: la conversion por el bolivar la hace el servidor al guardar, con las tasas del dia.
export function suggestedPrice(
  item: Item | undefined,
  unitId: string,
  priceList: { id: string; currency: string } | null,
  documentCurrency: string,
): number | null {
  if (!item || !priceList || priceList.currency !== documentCurrency) return null;

  const found = item.prices.find((price) => price.priceList.id === priceList.id);
  const unit = item.units.find((candidate) => candidate.unitId === unitId);

  if (!found || !unit) return null;

  return found.price * unit.conversionFactor;
}
