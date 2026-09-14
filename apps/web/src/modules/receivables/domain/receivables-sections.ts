import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

export const RECEIVABLES_SECTIONS = [
  { href: '/cuentas-por-cobrar/cobros', label: 'Cobros', testId: 'receivables-cobros', permission: 'receivables.payments.search' },
  { href: '/cuentas-por-cobrar/facturas', label: 'Facturas por cobrar', testId: 'receivables-facturas', permission: 'receivables.balances.search' },
  { href: '/cuentas-por-cobrar/antiguedad', label: 'Antigüedad', testId: 'receivables-antiguedad', permission: 'receivables.balances.search' },
  { href: '/cuentas-por-cobrar/estado-de-cuenta', label: 'Estado de cuenta', testId: 'receivables-estado-de-cuenta', permission: 'receivables.statements.search' },
];

export function visibleReceivablesSections(session: Session) {
  return RECEIVABLES_SECTIONS.filter((section) => can(session, section.permission));
}
