import { describe, expect, it } from 'vitest';
import { PermissionSearcher } from './permission-searcher.js';
import { CatalogPermissions } from '../../domain/role/catalog-permissions.js';

const searcher = new PermissionSearcher(new CatalogPermissions());

describe('PermissionSearcher', () => {
  it('returns the catalog', async () => {
    const { permissions } = await searcher.run();

    expect(permissions.length).toBeGreaterThan(0);
  });

  // La interfaz las agrupa por modulo en vez de pintar una lista plana.
  it('groups every permission under its module', async () => {
    const { permissions } = await searcher.run();

    expect(permissions.every((permission) => permission.module === 'access')).toBe(true);
  });

  it('describes every permission, because that is what a person reads', async () => {
    const { permissions } = await searcher.run();

    expect(permissions.every((permission) => permission.description.length > 0)).toBe(true);
  });
});
