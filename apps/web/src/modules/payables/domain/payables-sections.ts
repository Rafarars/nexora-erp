import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

export const PAYABLES_SECTIONS = [
  { href: '/cuentas-por-pagar/pagos', label: 'Pagos', testId: 'payables-pagos', permission: 'payables.payments.search' },
  { href: '/cuentas-por-pagar/facturas', label: 'Facturas por pagar', testId: 'payables-facturas', permission: 'payables.balances.search' },
  { href: '/cuentas-por-pagar/antiguedad', label: 'Antigüedad', testId: 'payables-antiguedad', permission: 'payables.balances.search' },
  { href: '/cuentas-por-pagar/estado-de-cuenta', label: 'Estado de cuenta', testId: 'payables-estado-de-cuenta', permission: 'payables.statements.search' },
  { href: '/cuentas-por-pagar/notas-de-credito', label: 'Notas de crédito', testId: 'payables-notas-de-credito', permission: 'payables.creditnotes.search' },
];

export function visiblePayablesSections(session: Session) {
  return PAYABLES_SECTIONS.filter((section) => can(session, section.permission));
}
