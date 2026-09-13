import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

export const INVENTORY_SECTIONS = [
  { href: '/inventario/existencias', label: 'Existencias', testId: 'inventory-existencias', permission: 'inventory.stock.search' },
  { href: '/inventario/ajustes', label: 'Ajustes', testId: 'inventory-ajustes', permission: 'inventory.adjustments.search' },
  { href: '/inventario/kardex', label: 'Kardex', testId: 'inventory-kardex', permission: 'inventory.movements.search' },
];

export function visibleInventorySections(session: Session) {
  return INVENTORY_SECTIONS.filter((section) => can(session, section.permission));
}
