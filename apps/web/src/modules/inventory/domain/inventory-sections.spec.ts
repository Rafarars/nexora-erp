import { describe, expect, it } from 'vitest';
import type { Session } from '../../access/domain/session';
import { visibleInventorySections } from './inventory-sections';

const session = (overrides: Partial<Session>): Session => ({
  userId: 'u',
  name: 'Ana',
  email: 'ana@acme.com',
  tenantId: 't',
  tenantName: 'Acme',
  permissions: [],
  grantsAll: false,
  availableTenants: [],
  ...overrides,
});

describe('visibleInventorySections', () => {
  it('shows every section to an administrator', () => {
    expect(visibleInventorySections(session({ grantsAll: true }))).toHaveLength(5);
  });

  it('shows only what the role can read', () => {
    const labels = visibleInventorySections(session({ permissions: ['inventory.stock.search', 'inventory.items.search'] })).map((s) => s.label);

    expect(labels).toEqual(['Artículos', 'Existencias', 'Bajo mínimo']);
  });

  it('hides the module from a role without inventory permissions', () => {
    expect(visibleInventorySections(session({ permissions: ['catalog.units.search'] }))).toEqual([]);
  });
});
