export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export const ACCOUNT_TYPES: readonly AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'] as const;

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === 'string' && ACCOUNT_TYPES.includes(value as AccountType);
}
