import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

export const PURCHASING_SECTIONS = [
  { href: '/compras/ordenes', label: 'Órdenes', testId: 'purchasing-ordenes', permission: 'purchasing.orders.search' },
  { href: '/compras/entradas', label: 'Entradas', testId: 'purchasing-entradas', permission: 'purchasing.receipts.search' },
  { href: '/compras/en-camino', label: 'En camino', testId: 'purchasing-en-camino', permission: 'purchasing.incoming.search' },
  { href: '/compras/proveedores', label: 'Proveedores', testId: 'purchasing-proveedores', permission: 'purchasing.suppliers.search' },
];

export function visiblePurchasingSections(session: Session) {
  return PURCHASING_SECTIONS.filter((section) => can(session, section.permission));
}
