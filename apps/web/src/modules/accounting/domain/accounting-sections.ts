import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

export interface AccountingSection {
  href: string;
  label: string;
  testId: string;
  permission: string;
}

export const ACCOUNTING_SECTIONS: AccountingSection[] = [
  { href: '/contabilidad/cuentas', label: 'Plan de cuentas', testId: 'accounting-cuentas', permission: 'accounting.accounts.search' },
];

export function visibleAccountingSections(session: Session): AccountingSection[] {
  return ACCOUNTING_SECTIONS.filter((s) => can(session, s.permission));
}
