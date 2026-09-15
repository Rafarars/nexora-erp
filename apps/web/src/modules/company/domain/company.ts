// El modelo de la empresa que usa la interfaz.
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
