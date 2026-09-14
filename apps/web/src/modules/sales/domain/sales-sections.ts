import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

export const SALES_SECTIONS = [
  { href: '/ventas/pedidos', label: 'Pedidos', testId: 'sales-pedidos', permission: 'sales.orders.search' },
  { href: '/ventas/despachos', label: 'Despachos', testId: 'sales-despachos', permission: 'sales.dispatches.search' },
  { href: '/ventas/facturas', label: 'Facturas', testId: 'sales-facturas', permission: 'sales.invoices.search' },
  { href: '/ventas/disponibilidad', label: 'Disponibilidad', testId: 'sales-disponibilidad', permission: 'sales.availability.search' },
  { href: '/ventas/clientes', label: 'Clientes', testId: 'sales-clientes', permission: 'sales.customers.search' },
];

export function visibleSalesSections(session: Session) {
  return SALES_SECTIONS.filter((section) => can(session, section.permission));
}
