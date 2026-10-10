export const OPENING_BALANCE_READER = Symbol('OpeningBalanceReader');

export interface OpeningBalanceTotals {
  inventoryTotal: number;
  receivablesTotal: number;
  payablesTotal: number;
}

/**
 * Puerto de dominio para consultar los saldos vivos iniciales
 * requeridos para generar el asiento de apertura contable (§3.13).
 */
export interface OpeningBalanceReader {
  hasOpeningBalance(tenantId: string): Promise<boolean>;
  readBalances(tenantId: string, decimals: number): Promise<OpeningBalanceTotals>;
}
