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
