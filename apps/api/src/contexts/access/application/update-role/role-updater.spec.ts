import { describe, expect, it } from 'vitest';
import { RoleUpdater } from './role-updater.js';
import { DuplicateRoleNameError } from '../../domain/errors/duplicate-role-name.error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error.js';
import { UnknownPermissionError } from '../../domain/errors/unknown-permission.error.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { ROLE_A, TENANT_A, TENANT_B, aRole, aTenant } from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';

function updaterFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new RoleUpdater(scenario.roleFinder, scenario.roles, scenario.catalog, scenario.clock);
}

async function permissionsOf(
  scenario: ReturnType<typeof anAccessScenario>,
): Promise<string[]> {
  const role = await scenario.roles.find(TenantId.of(TENANT_A), RoleId.of(ROLE_A));

  return role!.permissionCodes().map((code) => code.value).sort();
}

function aScenario() {
  return anAccessScenario({
    tenants: [aTenant()],
    roles: [aRole({ name: 'Ventas', permissions: ['access.users.search'] })],
  });
}

describe('RoleUpdater', () => {
  it('adds a permission that was not granted', async () => {
    const scenario = aScenario();

    await updaterFor(scenario).run({
      tenantId: TENANT_A,
      roleId: ROLE_A,
      name: 'Ventas',
      permissions: ['access.users.search', 'access.users.create'],
    });

    expect(await permissionsOf(scenario)).toEqual(['access.users.create', 'access.users.search']);
  });

  // Lo que pide Rafael: quitar un permiso es desmarcar una casilla.
  it('removes a permission that is no longer checked', async () => {
    const scenario = aScenario();

    await updaterFor(scenario).run({
      tenantId: TENANT_A,
      roleId: ROLE_A,
      name: 'Ventas',
      permissions: [],
    });

    expect(await permissionsOf(scenario)).toEqual([]);
  });

  it('renames the role', async () => {
    const scenario = aScenario();

    await updaterFor(scenario).run({
      tenantId: TENANT_A,
      roleId: ROLE_A,
      name: 'Comercial',
      permissions: ['access.users.search'],
    });

    const role = await scenario.roles.find(TenantId.of(TENANT_A), RoleId.of(ROLE_A));

    expect(role!.toPrimitives().name).toBe('Comercial');
  });

  // Guardar sin cambiar el nombre no puede chocar consigo mismo.
  it('lets a role keep its own name', async () => {
    const scenario = aScenario();

    await expect(
      updaterFor(scenario).run({
        tenantId: TENANT_A,
        roleId: ROLE_A,
        name: 'Ventas',
        permissions: [],
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects a name that another role already uses', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant()],
      roles: [aRole({ name: 'Ventas' }), aRole({ id: OTHER_ROLE, name: 'Compras' })],
    });

    await expect(
      updaterFor(scenario).run({
        tenantId: TENANT_A,
        roleId: ROLE_A,
        name: 'Compras',
        permissions: [],
      }),
    ).rejects.toThrow(DuplicateRoleNameError);
  });

  it('rejects a permission that is not in the catalog', async () => {
    const scenario = aScenario();

    await expect(
      updaterFor(scenario).run({
        tenantId: TENANT_A,
        roleId: ROLE_A,
        name: 'Ventas',
        permissions: ['ventas.borrar.todo'],
      }),
    ).rejects.toThrow(UnknownPermissionError);
  });

  // Aislamiento: un rol de otra empresa no se edita, ni se confirma que exista.
  it('rejects a role of another tenant', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      roles: [aRole({ id: OTHER_ROLE, tenantId: TENANT_B })],
    });

    await expect(
      updaterFor(scenario).run({
        tenantId: TENANT_A,
        roleId: OTHER_ROLE,
        name: 'Colado',
        permissions: [],
      }),
    ).rejects.toThrow(RoleNotFoundError);
  });
});
