// El modelo de la empresa que usa la interfaz.

// Legal: la oficial del BCV. Interna: la que carga la empresa. Son series independientes.
export type RateType = 'legal' | 'manual';

export const RATE_TYPE_LABELS: Record<RateType, string> = { legal: 'Legal (BCV)', manual: 'Interna' };

// Toda tasa esta expresada en bolivares: el bolivar no lleva tasa.
export const LOCAL_CURRENCY = 'VES';
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  isActive: boolean;
}

export interface CompanySettings {
  baseCurrency: Omit<Currency, 'isActive'>;
  secondaryCurrency: Omit<Currency, 'isActive'> | null;
  dualCurrency: boolean;
  timeZone: string;
  amountDecimals: number;
  priceDecimals: number;
  // La serie de tasas con que se valoran los documentos.
  rateType: RateType;
  // Si un documento puede llevar una tasa escrita a mano.
  allowsRateOverride: boolean;
  // Hoy en la zona de la empresa: la fecha que proponen los documentos.
  today: string;
}

export interface CompanyProfile {
  legalName: string;
  tradeName: string | null;
  fiscalId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export const AMOUNT_DECIMALS_MAX = 4;
export const PRICE_DECIMALS_MAX = 6;

// Las monedas que se ofrecen: las activas, y la que la empresa ya tiene aunque se haya retirado.
export function currencyOptions(currencies: Currency[], ...current: (string | null | undefined)[]): Currency[] {
  return currencies.filter((currency) => currency.isActive || current.includes(currency.code));
}

// Todas las zonas IANA que conoce el servidor, con la actual siempre presente.
export function timeZoneOptions(known: string[], current: string): string[] {
  return known.includes(current) ? known : [current, ...known];
}

// Bolivares por 1 unidad de la moneda en un dia.
export interface ExchangeRate {
  id: string;
  currency: string;
  rateDate: string;
  type: RateType;
  rate: number;
  source: string | null;
  isActive: boolean;
}

// Lo que usaria un documento de ese dia: la tasa del dia o la ultima anterior.
export interface CurrentRate {
  currency: string;
  name: string;
  rate: number | null;
  rateDate: string | null;
}

export interface ExchangeRateBoard {
  date: string;
  rateType: RateType;
  rates: ExchangeRate[];
  current: CurrentRate[];
}

export interface RateFilter {
  currency?: string;
  type?: string;
  from?: string;
  to?: string;
}

// El listado trae como mucho las mas recientes: con este numero se avisa que hay mas.
export const RATE_LIST_LIMIT = 500;

// Las monedas que llevan tasa: las activas, menos el bolivar.
export function rateCurrencies(currencies: Currency[]): Currency[] {
  return currencies.filter((currency) => currency.isActive && currency.code !== LOCAL_CURRENCY);
}

// Con coma decimal, al menos dos decimales y sin separador de miles: el mismo texto vuelve al
// formulario al corregirla.
export function formatRate(value: number): string {
  return value.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 8, useGrouping: false });
}

// Solo los filtros con valor viajan en la URL.
export function rateFilterQuery(filter: RateFilter): string {
  const params = new URLSearchParams(Object.entries(filter).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const query = params.toString();

  return query ? `?${query}` : '';
}
