import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

// Los articulos primero: son el maestro del que hablan las existencias, los ajustes y el kardex.
export const INVENTORY_SECTIONS = [
  { href: '/inventario/articulos', label: 'Artículos', testId: 'inventory-articulos', permission: 'inventory.items.search' },
  { href: '/inventario/existencias', label: 'Existencias', testId: 'inventory-existencias', permission: 'inventory.stock.search' },
  { href: '/inventario/ajustes', label: 'Ajustes', testId: 'inventory-ajustes', permission: 'inventory.adjustments.search' },
  { href: '/inventario/kardex', label: 'Kardex', testId: 'inventory-kardex', permission: 'inventory.movements.search' },
];

export function visibleInventorySections(session: Session) {
  return INVENTORY_SECTIONS.filter((section) => can(session, section.permission));
}
