import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

export const REPORT_SECTIONS = [
  { href: '/reportes/antiguedad', label: 'Antigüedad de saldos', testId: 'reports-antiguedad', permission: 'reports.receivables.search' },
  { href: '/reportes/estado-de-cuenta', label: 'Estado de cuenta', testId: 'reports-estado-de-cuenta', permission: 'reports.receivables.search' },
  { href: '/reportes/ventas-por-cliente', label: 'Ventas por cliente', testId: 'reports-ventas-por-cliente', permission: 'reports.sales.search' },
  { href: '/reportes/valuacion-inventario', label: 'Valuación del inventario', testId: 'reports-valuacion-inventario', permission: 'reports.inventory.search' },
];

export function visibleReportSections(session: Session) {
  return REPORT_SECTIONS.filter((section) => can(session, section.permission));
}
