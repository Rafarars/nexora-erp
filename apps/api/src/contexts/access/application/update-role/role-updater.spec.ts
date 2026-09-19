import { describe, expect, it } from 'vitest';
import { RoleUpdater } from './role-updater.js';
import { CannotEditAdminRoleError } from '../../domain/errors/cannot-edit-admin-role.error.js';
import { DuplicateRoleNameError } from '../../domain/errors/duplicate-role-name.error.js';
import { RoleWithoutPermissionsError } from '../../domain/errors/role-without-permissions.error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error.js';
import { UnknownPermissionError } from '../../domain/errors/unknown-permission.error.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import {
  ROLE_A,
  TENANT_A,
  TENANT_B,
  aRole,
  aTenant,
  anAdminRole,
} from '../../domain/testing/access.mother.js';
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

  // Lo que pide Rafael: quitar un permiso es desmarcar una casilla. Desmarcarlas TODAS ya
  // no se puede, porque un rol sin nada no da acceso a nada.
  it('removes a permission that is no longer checked', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant()],
      roles: [
        aRole({ name: 'Ventas', permissions: ['access.users.search', 'access.users.create'] }),
      ],
    });

    await updaterFor(scenario).run({
      tenantId: TENANT_A,
      roleId: ROLE_A,
      name: 'Ventas',
      permissions: ['access.users.search'],
    });

    expect(await permissionsOf(scenario)).toEqual(['access.users.search']);
  });

  it('refuses to leave a role with no permissions at all', async () => {
    const scenario = aScenario();

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, roleId: ROLE_A, name: 'Ventas', permissions: [] }),
    ).rejects.toThrow(RoleWithoutPermissionsError);

    expect(await permissionsOf(scenario)).toEqual(['access.users.search']);
  });

  // La pantalla ya escondia su boton de editar; por la API se le podia cambiar el nombre y
  // seguia concediendolo todo.
  it('refuses to edit the role that grants everything', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()], roles: [anAdminRole()] });

    await expect(
      updaterFor(scenario).run({
        tenantId: TENANT_A,
        roleId: ROLE_A,
        name: 'Consulta basica',
        permissions: ['access.users.search'],
      }),
    ).rejects.toThrow(CannotEditAdminRoleError);

    const role = await scenario.roles.find(TenantId.of(TENANT_A), RoleId.of(ROLE_A));
    expect(role!.toPrimitives().name).toBe('Administrator');
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
        permissions: ['access.users.search'],
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
        permissions: ['access.users.search'],
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
        permissions: ['access.users.search'],
      }),
    ).rejects.toThrow(RoleNotFoundError);
  });
});
