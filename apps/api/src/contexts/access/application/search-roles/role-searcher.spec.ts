import { describe, expect, it } from 'vitest';
import { RoleSearcher } from './role-searcher.js';
import { TENANT_A, TENANT_B, aRole, anAdminRole } from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';

describe('RoleSearcher', () => {
  it('lists the roles of the tenant with their permissions', async () => {
    const scenario = anAccessScenario({
      roles: [aRole({ name: 'Ventas', permissions: ['access.users.search'] })],
    });

    const { roles } = await new RoleSearcher(scenario.roles).run({ tenantId: TENANT_A });

    expect(roles).toEqual([
      { id: roles[0].id, name: 'Ventas', grantsAll: false, permissions: ['access.users.search'] },
    ]);
  });

  // Un administrador no enumera permisos: la interfaz lo pinta distinto.
  it('reports an administrator without listing permissions', async () => {
    const scenario = anAccessScenario({ roles: [anAdminRole()] });

    const { roles } = await new RoleSearcher(scenario.roles).run({ tenantId: TENANT_A });

    expect(roles[0].grantsAll).toBe(true);
    expect(roles[0].permissions).toEqual([]);
  });

  it('never lists a role of another tenant', async () => {
    const scenario = anAccessScenario({
      roles: [aRole({ name: 'Ventas' }), aRole({ id: OTHER_ROLE, tenantId: TENANT_B })],
    });

    const { roles } = await new RoleSearcher(scenario.roles).run({ tenantId: TENANT_A });

    expect(roles).toHaveLength(1);
  });

  it('sorts by name, so the listing is stable', async () => {
    const scenario = anAccessScenario({
      roles: [aRole({ name: 'Ventas' }), aRole({ id: OTHER_ROLE, name: 'Compras' })],
    });

    const { roles } = await new RoleSearcher(scenario.roles).run({ tenantId: TENANT_A });

    expect(roles.map((role) => role.name)).toEqual(['Compras', 'Ventas']);
  });

  it('returns an empty list for a tenant with no roles', async () => {
    expect(await new RoleSearcher(anAccessScenario().roles).run({ tenantId: TENANT_A })).toEqual({
      roles: [],
    });
  });
});
