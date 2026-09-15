import { CurrencyCode } from './currency-code.vo.js';

export const CURRENCY_CATALOG = Symbol('CurrencyCatalog');

// Las monedas que existen, iguales para todas las empresas. No tiene pantalla de captura: llegan
// con las migraciones.
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  isActive: boolean;
}

export interface CurrencyCatalog {
  searchAll(): Promise<Currency[]>;
  find(code: CurrencyCode): Promise<Currency | null>;
}
