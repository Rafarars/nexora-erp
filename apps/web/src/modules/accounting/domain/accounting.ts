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
