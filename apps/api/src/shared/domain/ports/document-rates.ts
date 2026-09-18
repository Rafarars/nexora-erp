import { hasAtMostDecimals } from '../amount.js';
import { ConflictError, InvalidArgumentError } from '../domain.error.js';

export const DOCUMENT_RATES = Symbol('DocumentRates');

// Lo que congela un documento al emitirse: bolivares por 1 unidad de su moneda y por 1 unidad de la
// moneda de la empresa en ese momento. Con los dos pares se reexpresa en bolivares y en la moneda de
// la empresa aunque esta cambie despues.
export interface DocumentRateSet {
  currency: string;
  exchangeRate: number;
  baseCurrency: string;
  baseExchangeRate: number;
  // La tasa del documento la escribio una persona.
  manualRate: boolean;
}

export interface DocumentRateRequest {
  // Sin moneda, la de la empresa.
  currency?: string | null;
  // `YYYY-MM-DD`
  date: string;
  // Una tasa escrita a mano, si la empresa lo permite. Nunca para su moneda ni para el bolivar.
  manualRate?: number | null;
  // Un documento que ya tenia esa moneda la conserva aunque se haya retirado del catalogo.
  keepsCurrency?: boolean;
}

// Lo publica el contexto de empresa. Usa la serie de tasas que eligio la empresa y la tasa de la
// fecha del documento o la ultima anterior. Sin tasa rechaza: el documento no se emite.
export interface DocumentRates {
  forDocument(tenantId: string, request: DocumentRateRequest): Promise<DocumentRateSet>;
  // Con cuantos decimales redondea la empresa los importes de sus documentos.
  amountDecimals(tenantId: string): Promise<number>;
  // Cuantos decimales admiten los precios y costos por unidad.
  priceDecimals(tenantId: string): Promise<number>;
  // En que moneda lleva la empresa sus cifras: en ella se expresan los saldos y los reportes.
  companyCurrency(tenantId: string): Promise<string>;
  // Bolivares por 1 unidad de esa moneda en esa fecha. Lo usa el precio de una lista que esta en
  // otra moneda que el documento: se pasa por el bolivar, como el cobro de una factura ajena.
  rateFor(tenantId: string, currency: string, date: string): Promise<number>;
}

// Un precio o costo con mas decimales de los que la empresa lleva en sus precios.
export async function ensurePriceDecimals(rates: DocumentRates, tenantId: string, prices: number[]): Promise<void> {
  const decimals = await rates.priceDecimals(tenantId);
  const excess = prices.find((price) => Number.isFinite(price) && !hasAtMostDecimals(price, decimals));

  if (excess !== undefined) throw new PriceDecimalsExceededError(excess, decimals);
}

// Los errores del lenguaje publicado: los lanza la empresa y los ven compras y ventas.

// Sin tasa, un documento en esa moneda no se emite: es preferible a emitirlo con tasa 1.
export class MissingExchangeRateError extends ConflictError {
  constructor(currency: string, type: string, date: string) {
    super(`No active ${type} rate for <${currency}> on or before <${date}>.`, 'There is no exchange rate for that currency on that date.');
  }
}

export class RateOverrideNotAllowedError extends ConflictError {
  constructor(tenantId: string) {
    super(`Tenant <${tenantId}> does not allow writing the exchange rate of a document.`, 'The company does not allow writing the exchange rate of a document.');
  }
}

// La moneda de la empresa y el bolivar tienen la tasa del catalogo, o 1: no se corrigen a mano.
export class FixedExchangeRateError extends InvalidArgumentError {
  constructor(currency: string) {
    super(`The rate of <${currency}> cannot be written by hand.`, 'The rate of the company currency and of the bolivar cannot be written by hand.');
  }
}

export class PriceDecimalsExceededError extends InvalidArgumentError {
  constructor(value: number, decimals: number) {
    super(`The price <${value}> has more than <${decimals}> decimal places.`, 'A price has more decimal places than the company uses.');
  }
}
