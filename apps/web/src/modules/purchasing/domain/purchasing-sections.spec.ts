import { describe, expect, it } from 'vitest';
import type { Session } from '../../access/domain/session';
import { visiblePurchasingSections } from './purchasing-sections';

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

describe('visiblePurchasingSections', () => {
  it('shows every section to an administrator, orders first', () => {
    expect(visiblePurchasingSections(session({ grantsAll: true })).map((s) => s.label)).toEqual(['Órdenes', 'Entradas', 'En camino', 'Proveedores']);
  });

  it('shows only what the role can read', () => {
    const labels = visiblePurchasingSections(session({ permissions: ['purchasing.incoming.search'] })).map((s) => s.label);

    expect(labels).toEqual(['En camino']);
  });

  it('hides the module from a role without purchasing permissions', () => {
    expect(visiblePurchasingSections(session({ permissions: ['inventory.stock.search'] }))).toEqual([]);
  });
});
