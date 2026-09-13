import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

export interface CatalogSection {
  href: string;
  label: string;
  testId: string;
  permission: string;
}

// El orden es el de uso: los articulos primero, lo que los alimenta despues.
export const CATALOG_SECTIONS: CatalogSection[] = [
  { href: '/catalogo/articulos', label: 'Artículos', testId: 'catalog-articulos', permission: 'catalog.items.search' },
  { href: '/catalogo/categorias', label: 'Categorías', testId: 'catalog-categorias', permission: 'catalog.categories.search' },
  { href: '/catalogo/unidades', label: 'Unidades', testId: 'catalog-unidades', permission: 'catalog.units.search' },
  { href: '/catalogo/impuestos', label: 'Impuestos', testId: 'catalog-impuestos', permission: 'catalog.taxes.search' },
  { href: '/catalogo/bodegas', label: 'Bodegas', testId: 'catalog-bodegas', permission: 'catalog.warehouses.search' },
];

// Solo las secciones que el rol puede ver: un enlace que acaba en "no tienes permiso"
// es ruido.
export function visibleCatalogSections(session: Session): CatalogSection[] {
  return CATALOG_SECTIONS.filter((section) => can(session, section.permission));
}
