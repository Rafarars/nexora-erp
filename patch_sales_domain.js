const fs = require('fs');

const addition = `
export interface DocumentCurrency {
  currency: string;
  exchangeRate: number | null;
  baseCurrency: string;
  baseExchangeRate: number | null;
  manualExchangeRate: boolean;
}

export function formatAmount(value: number): string {
  return value.toLocaleString('es', { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false });
}

export function inBolivars(amount: number, document: DocumentCurrency): number | null {
  if (document.currency === 'VES') return amount;
  if (document.exchangeRate === null) return null;
  return Math.round(amount * document.exchangeRate * 10000) / 10000;
}

export function offersManualRate(currency: string, baseCurrency: string, allowsRateOverride: boolean): boolean {
  return allowsRateOverride && currency !== baseCurrency && currency !== 'VES';
}
`;

let file = fs.readFileSync('apps/web/src/modules/sales/domain/sales.ts', 'utf8');
fs.writeFileSync('apps/web/src/modules/sales/domain/sales.ts', file + addition);

let file2 = fs.readFileSync('apps/web/src/modules/receivables/domain/receivables.ts', 'utf8');
fs.writeFileSync('apps/web/src/modules/receivables/domain/receivables.ts', file2 + addition);

