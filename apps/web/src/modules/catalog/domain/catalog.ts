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

// Lo que se ofrece en un selector: los activos, y ademas el que el registro ya tiene
// aunque se haya desactivado despues, para que editarlo no lo borre en silencio.
export function selectableOptions<T extends CatalogRecord>(records: T[], currentId?: string | null): T[] {
  return records.filter((record) => record.isActive || record.id === currentId);
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
  return value.toLocaleString('es', { maximumFractionDigits: 8, useGrouping: false });
}
