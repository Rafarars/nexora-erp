export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Activo',
  liability: 'Pasivo',
  equity: 'Patrimonio',
  income: 'Ingreso',
  expense: 'Gasto',
};

export interface AccountRow {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
  acceptsEntries: boolean;
  parentId: string | null;
  isActive: boolean;
}

export interface AccountTreeNode extends AccountRow {
  children?: AccountTreeNode[];
}

export interface JournalEntryListItem {
  id: string;
  code: string;
  entryDate: string;
  originType: string;
  originId: string;
  description: string;
  currency: string;
  reversalOfId: string | null;
  totalDebit: number;
  totalCredit: number;
  linesCount: number;
}

export interface SearchJournalEntriesResponse {
  items: JournalEntryListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JournalEntryLineDetail {
  id: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  label: string;
}

export interface JournalEntryDetail {
  id: string;
  code: string;
  entryDate: string;
  originType: string;
  originId: string;
  description: string;
  currency: string;
  reversalOfId: string | null;
  totalDebit: number;
  totalCredit: number;
  lines: JournalEntryLineDetail[];
}

export const ORIGIN_TYPE_LABELS: Record<string, string> = {
  goods_receipt: 'Entrada de mercancía',
  dispatch: 'Despacho',
  sales_invoice: 'Factura de venta',
  purchase_invoice: 'Factura de compra',
  customer_payment: 'Cobro',
  customer_payment_credit_note: 'Cobro con NCC',
  customer_credit_note: 'Nota de crédito cliente',
  supplier_payment: 'Pago a proveedor',
  supplier_credit_note: 'Nota de crédito proveedor',
  supplier_payment_credit_note: 'Pago con NCP',
  sales_return: 'Devolución de venta',
  purchase_return: 'Devolución de compra',
  inventory_adjustment: 'Ajuste de inventario',
  price_revaluation: 'Revaluación de precio',
  opening_balance: 'Asiento de apertura',
  reversal: 'Reverso',
};
