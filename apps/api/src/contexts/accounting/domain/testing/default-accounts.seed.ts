export interface DefaultAccountDef {
  key: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  acceptsEntries: boolean;
  parentKey?: string;
  isDefaultCompanySetting?: string;
}

export const DEFAULT_ACCOUNTS_CATALOG: DefaultAccountDef[] = [
  // 1. Activo
  { key: 'ACT', code: '1', name: 'Activo', type: 'asset', acceptsEntries: false },
  { key: 'ACT_CORR', code: '1.1', name: 'Activo corriente', type: 'asset', acceptsEntries: false, parentKey: 'ACT' },
  { key: 'CASH_GRP', code: '1.1.01', name: 'Efectivo y equivalentes', type: 'asset', acceptsEntries: false, parentKey: 'ACT_CORR' },
  { key: 'CASH', code: '1.1.01.001', name: 'Caja y bancos', type: 'asset', acceptsEntries: true, parentKey: 'CASH_GRP', isDefaultCompanySetting: 'cashAccountId' },
  { key: 'REC_GRP', code: '1.1.02', name: 'Cuentas por cobrar comerciales', type: 'asset', acceptsEntries: false, parentKey: 'ACT_CORR' },
  { key: 'REC', code: '1.1.02.001', name: 'Clientes por cobrar', type: 'asset', acceptsEntries: true, parentKey: 'REC_GRP', isDefaultCompanySetting: 'receivablesAccountId' },
  { key: 'INV_GRP', code: '1.1.03', name: 'Inventarios', type: 'asset', acceptsEntries: false, parentKey: 'ACT_CORR' },
  { key: 'INV', code: '1.1.03.001', name: 'Inventario de mercancías', type: 'asset', acceptsEntries: true, parentKey: 'INV_GRP', isDefaultCompanySetting: 'inventoryAccountId' },
  { key: 'UNAP_CN_GRP', code: '1.1.05', name: 'Anticipos y créditos a clientes', type: 'asset', acceptsEntries: false, parentKey: 'ACT_CORR' },
  { key: 'UNAP_CN', code: '1.1.05.001', name: 'Notas de crédito por aplicar', type: 'asset', acceptsEntries: true, parentKey: 'UNAP_CN_GRP', isDefaultCompanySetting: 'unappliedCreditNotesAccountId' },

  // 2. Pasivo
  { key: 'PAS', code: '2', name: 'Pasivo', type: 'liability', acceptsEntries: false },
  { key: 'PAS_CORR', code: '2.1', name: 'Pasivo corriente', type: 'liability', acceptsEntries: false, parentKey: 'PAS' },
  { key: 'PAY_GRP', code: '2.1.01', name: 'Cuentas por pagar comerciales', type: 'liability', acceptsEntries: false, parentKey: 'PAS_CORR' },
  { key: 'PAY', code: '2.1.01.001', name: 'Proveedores por pagar', type: 'liability', acceptsEntries: true, parentKey: 'PAY_GRP', isDefaultCompanySetting: 'payablesAccountId' },
  { key: 'UNBILLED_GRP', code: '2.1.02', name: 'Provisiones y transitorias de compras', type: 'liability', acceptsEntries: false, parentKey: 'PAS_CORR' },
  { key: 'UNBILLED', code: '2.1.02.001', name: 'Mercancía por facturar', type: 'liability', acceptsEntries: true, parentKey: 'UNBILLED_GRP', isDefaultCompanySetting: 'unbilledGoodsAccountId' },
  { key: 'TAX_GRP', code: '2.1.03', name: 'Impuestos por pagar', type: 'liability', acceptsEntries: false, parentKey: 'PAS_CORR' },
  { key: 'TAX', code: '2.1.03.001', name: 'Impuesto por pagar', type: 'liability', acceptsEntries: true, parentKey: 'TAX_GRP', isDefaultCompanySetting: 'taxPayableAccountId' },
  { key: 'UNAP_SUP_CN_GRP', code: '2.1.04', name: 'Créditos de proveedores', type: 'liability', acceptsEntries: false, parentKey: 'PAS_CORR' },
  { key: 'UNAP_SUP_CN', code: '2.1.04.001', name: 'Notas de crédito de proveedor por aplicar', type: 'liability', acceptsEntries: true, parentKey: 'UNAP_SUP_CN_GRP', isDefaultCompanySetting: 'unappliedSupplierCreditNotesAccountId' },
  { key: 'PEND_PRICE_GRP', code: '2.1.05', name: 'Transitorias de diferencias de compras', type: 'liability', acceptsEntries: false, parentKey: 'PAS_CORR' },
  { key: 'PEND_PRICE', code: '2.1.05.001', name: 'Diferencia de precio pendiente', type: 'liability', acceptsEntries: true, parentKey: 'PEND_PRICE_GRP', isDefaultCompanySetting: 'pendingPriceDifferenceAccountId' },

  // 3. Patrimonio
  { key: 'PAT', code: '3', name: 'Patrimonio', type: 'equity', acceptsEntries: false },
  { key: 'PAT_GRP', code: '3.1', name: 'Capital y patrimonio neto', type: 'equity', acceptsEntries: false, parentKey: 'PAT' },
  { key: 'OPEN_EQUITY', code: '3.1.01.001', name: 'Patrimonio de apertura', type: 'equity', acceptsEntries: true, parentKey: 'PAT_GRP', isDefaultCompanySetting: 'openingEquityAccountId' },

  // 4. Ingresos
  { key: 'ING', code: '4', name: 'Ingresos', type: 'income', acceptsEntries: false },
  { key: 'ING_GRP', code: '4.1', name: 'Ingresos operacionales', type: 'income', acceptsEntries: false, parentKey: 'ING' },
  { key: 'REV', code: '4.1.01.001', name: 'Ingresos por ventas', type: 'income', acceptsEntries: true, parentKey: 'ING_GRP', isDefaultCompanySetting: 'salesRevenueAccountId' },

  // 5. Costos y Gastos
  { key: 'GAS', code: '5', name: 'Costos y Gastos', type: 'expense', acceptsEntries: false },
  { key: 'COGS_GRP', code: '5.1', name: 'Costos operacionales', type: 'expense', acceptsEntries: false, parentKey: 'GAS' },
  { key: 'COGS', code: '5.1.01.001', name: 'Costo de ventas', type: 'expense', acceptsEntries: true, parentKey: 'COGS_GRP', isDefaultCompanySetting: 'cogsAccountId' },
  { key: 'PURCH_EXP_GRP', code: '5.2', name: 'Gastos operativos de compras', type: 'expense', acceptsEntries: false, parentKey: 'GAS' },
  { key: 'PURCH_EXP', code: '5.2.01.001', name: 'Gasto de compras', type: 'expense', acceptsEntries: true, parentKey: 'PURCH_EXP_GRP', isDefaultCompanySetting: 'purchaseExpenseAccountId' },
  { key: 'INV_ADJ_GRP', code: '5.3', name: 'Ajustes operativos de inventario', type: 'expense', acceptsEntries: false, parentKey: 'GAS' },
  { key: 'INV_ADJ', code: '5.3.01.001', name: 'Ajuste de inventario', type: 'expense', acceptsEntries: true, parentKey: 'INV_ADJ_GRP', isDefaultCompanySetting: 'inventoryAdjustmentAccountId' },
  { key: 'PRICE_DIFF_GRP', code: '5.4', name: 'Variaciones de compras', type: 'expense', acceptsEntries: false, parentKey: 'GAS' },
  { key: 'PRICE_DIFF', code: '5.4.01.001', name: 'Diferencia de precio de compra', type: 'expense', acceptsEntries: true, parentKey: 'PRICE_DIFF_GRP', isDefaultCompanySetting: 'priceDifferenceAccountId' },
  { key: 'EXCH_DIFF_GRP', code: '5.5', name: 'Resultados por diferencia en cambio', type: 'expense', acceptsEntries: false, parentKey: 'GAS' },
  { key: 'EXCH_DIFF', code: '5.5.01.001', name: 'Diferencia en cambio', type: 'expense', acceptsEntries: true, parentKey: 'EXCH_DIFF_GRP', isDefaultCompanySetting: 'exchangeDifferenceAccountId' },
];
