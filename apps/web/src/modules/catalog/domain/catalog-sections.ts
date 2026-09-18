import { can } from '../../access/domain/session';
import type { Session } from '../../access/domain/session';

export interface CatalogSection {
  href: string;
  label: string;
  testId: string;
  permission: string;
}

// Lo que alimenta a los articulos y a los documentos. Los articulos viven en el inventario.
export const CATALOG_SECTIONS: CatalogSection[] = [
  { href: '/catalogo/categorias', label: 'Categorías', testId: 'catalog-categorias', permission: 'catalog.categories.search' },
  { href: '/catalogo/unidades', label: 'Unidades', testId: 'catalog-unidades', permission: 'catalog.units.search' },
  { href: '/catalogo/impuestos', label: 'Impuestos', testId: 'catalog-impuestos', permission: 'catalog.taxes.search' },
  { href: '/catalogo/bodegas', label: 'Bodegas', testId: 'catalog-bodegas', permission: 'catalog.warehouses.search' },
  { href: '/catalogo/listas-de-precio', label: 'Listas de precio', testId: 'catalog-listas-de-precio', permission: 'catalog.pricelists.search' },
];

// Solo las secciones que el rol puede ver: un enlace que acaba en "no tienes permiso"
// es ruido.
export function visibleCatalogSections(session: Session): CatalogSection[] {
  return CATALOG_SECTIONS.filter((section) => can(session, section.permission));
}
