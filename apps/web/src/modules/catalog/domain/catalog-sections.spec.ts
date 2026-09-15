import { describe, expect, it } from 'vitest';
import type { Session } from '../../access/domain/session';
import { CATALOG_SECTIONS, visibleCatalogSections } from './catalog-sections';

function aSession(overrides: Partial<Session> = {}): Session {
  return {
    userId: 'u1',
    name: 'Ana',
    email: 'ana@acme.com',
    tenantId: 't1',
    tenantName: 'Acme',
    permissions: [],
    grantsAll: false,
    availableTenants: [],
    ...overrides,
  };
}

describe('visibleCatalogSections', () => {
  it('shows every section to an administrator', () => {
    expect(visibleCatalogSections(aSession({ grantsAll: true }))).toEqual(CATALOG_SECTIONS);
  });

  it('shows only what the role can search', () => {
    const sections = visibleCatalogSections(aSession({ permissions: ['catalog.units.search', 'catalog.taxes.search'] }));

    expect(sections.map((section) => section.label)).toEqual(['Unidades', 'Impuestos']);
  });

  // Sin ninguna, el modulo entero desaparece de la barra lateral.
  it('shows nothing to a role without catalog permissions', () => {
    expect(visibleCatalogSections(aSession({ permissions: ['access.users.search', 'inventory.items.search'] }))).toEqual([]);
  });
});
