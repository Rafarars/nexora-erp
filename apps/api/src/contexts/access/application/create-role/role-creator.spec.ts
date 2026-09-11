import { describe, expect, it } from 'vitest';
import { RoleCreator } from './role-creator.js';
import { DuplicateRoleNameError } from '../../domain/errors/duplicate-role-name.error.js';
import { UnknownPermissionError } from '../../domain/errors/unknown-permission.error.js';
import { PermissionCode } from '../../domain/role/permission-code.vo.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { TENANT_A, aRole, aTenant } from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

function creatorFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new RoleCreator(scenario.roles, scenario.catalog, scenario.ids, scenario.clock);
}

describe('RoleCreator', () => {
  it('creates a role with the permissions asked for', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()] });

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
      name: 'Ventas',
      permissions: ['access.users.search'],
    });

    const [role] = await scenario.roles.searchByTenant(TenantId.of(TENANT_A));

    expect(role.toPrimitives().name).toBe('Ventas');
    expect(role.grants(PermissionCode.of('access.users.search'))).toBe(true);
  });

  it('creates a role with no permissions at all', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()] });

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Sin permisos', permissions: [] });

    const [role] = await scenario.roles.searchByTenant(TenantId.of(TENANT_A));

    expect(role.permissionCodes()).toEqual([]);
  });

  // Dos roles homonimos en una empresa harian imposible saber cual se asigna.
  it('rejects a name already used in the tenant', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()], roles: [aRole({ name: 'Ventas' })] });

    await expect(
      creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Ventas', permissions: [] }),
    ).rejects.toThrow(DuplicateRoleNameError);
  });

  // Conceder un permiso inexistente reventaria contra la clave ajena de la base.
  it('rejects a permission that is not in the catalog', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()] });

    await expect(
      creatorFor(scenario).run({
        tenantId: TENANT_A,
        name: 'Ventas',
        permissions: ['ventas.borrar.todo'],
      }),
    ).rejects.toThrow(UnknownPermissionError);
  });

  it('creates nothing when a permission is invalid', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()] });

    await expect(
      creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Ventas', permissions: ['nope.nope'] }),
    ).rejects.toThrow();

    expect(await scenario.roles.searchByTenant(TenantId.of(TENANT_A))).toEqual([]);
  });

  it('ignores a permission sent twice', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()] });

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
      name: 'Ventas',
      permissions: ['access.users.search', 'access.users.search'],
    });

    const [role] = await scenario.roles.searchByTenant(TenantId.of(TENANT_A));

    expect(role.permissionCodes()).toHaveLength(1);
  });
});
