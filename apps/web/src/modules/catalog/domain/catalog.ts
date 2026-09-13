// El modelo del catalogo que usa la interfaz. Hoy casi igual a la API; el adaptador
// traduce, y el dia que la API cambie solo se toca alli.
export interface CatalogRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface Category extends CatalogRecord {
  description: string | null;
}

export interface MeasurementUnit extends CatalogRecord {
  abbreviation: string;
}

export interface Tax extends CatalogRecord {
  rate: number;
}

export interface Warehouse extends CatalogRecord {
  address: string | null;
  isDefault: boolean;
}

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
  tax: { id: string; name: string; rate: number } | null;
  units: ItemUnit[];
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  inventoried: 'Inventariado',
  service: 'Servicio',
};

// Lo que se ofrece en un selector: los activos, y ademas el que el registro ya tiene
// aunque se haya desactivado despues, para que editarlo no lo borre en silencio.
export function selectableOptions<T extends CatalogRecord>(records: T[], currentId?: string | null): T[] {
  return records.filter((record) => record.isActive || record.id === currentId);
}

// "1 cja = 24 un": como se lee una equivalencia en un almacen.
export function describeUnits(units: ItemUnit[]): string {
  const base = units.find((unit) => unit.isBase);

  if (!base) return '';

  const others = units
    .filter((unit) => !unit.isBase)
    .map((unit) => `1 ${unit.abbreviation} = ${formatNumber(unit.conversionFactor)} ${base.abbreviation}`);

  return [base.abbreviation, ...others].join(' · ');
}

// Quien escribe en espanol pone coma decimal: "8,5" es 8.5. Lo que no es un numero
// devuelve NaN y lo rechaza la API senalando el campo.
export function parseDecimal(text: string): number {
  const normalized = text.trim().replace(',', '.');

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return Number.NaN;
  }

  return Number(normalized);
}

// Sin separador de miles: el mismo texto vuelve a los campos editables, y "12.345" no se
// entenderia al guardarlo otra vez.
export function formatNumber(value: number): string {
  return value.toLocaleString('es', { maximumFractionDigits: 4, useGrouping: false });
}
