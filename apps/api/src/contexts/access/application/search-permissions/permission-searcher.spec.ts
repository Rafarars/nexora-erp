import { describe, expect, it } from 'vitest';
import { PermissionSearcher } from './permission-searcher.js';
import { CatalogPermissions } from '../../domain/role/catalog-permissions.js';

const searcher = new PermissionSearcher(new CatalogPermissions());

describe('PermissionSearcher', () => {
  it('returns the catalog', async () => {
    const { permissions } = await searcher.run();

    expect(permissions.length).toBeGreaterThan(0);
  });

  // La interfaz las agrupa por modulo en vez de pintar una lista plana. El modulo es el
  // primer segmento del codigo: `catalog.items.create` va bajo `catalog`.
  it('groups every permission under the module its code starts with', async () => {
    const { permissions } = await searcher.run();

    expect(permissions.every((permission) => permission.code.startsWith(`${permission.module}.`))).toBe(true);
    expect([...new Set(permissions.map((permission) => permission.module))]).toEqual(['access', 'catalog', 'inventory', 'purchasing']);
  });

  it('describes every permission, because that is what a person reads', async () => {
    const { permissions } = await searcher.run();

    expect(permissions.every((permission) => permission.description.length > 0)).toBe(true);
  });
});
