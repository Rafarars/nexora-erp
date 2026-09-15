export const DOCUMENT_RATES = Symbol('DocumentRates');

// Lo que congela un documento al emitirse: bolivares por 1 unidad de su moneda y por 1 unidad de la
// moneda de la empresa en ese momento. Con los dos pares se reexpresa en bolivares y en la moneda de
// la empresa aunque esta cambie despues.
export interface DocumentRateSet {
  currency: string;
  exchangeRate: number;
  baseCurrency: string;
  baseExchangeRate: number;
}

// Lo publica el contexto de empresa. Usa la serie de tasas que eligio la empresa y la tasa de la
// fecha del documento o la ultima anterior. Sin tasa rechaza: el documento no se emite.
export interface DocumentRates {
  // `date` como `YYYY-MM-DD`
  forDocument(tenantId: string, currency: string, date: string): Promise<DocumentRateSet>;
}
