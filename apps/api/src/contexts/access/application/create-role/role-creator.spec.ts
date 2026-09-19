import { describe, expect, it } from 'vitest';
import { RoleCreator } from './role-creator.js';
import { DuplicateRoleNameError } from '../../domain/errors/duplicate-role-name.error.js';
import { RoleWithoutPermissionsError } from '../../domain/errors/role-without-permissions.error.js';
import { UnknownPermissionError } from '../../domain/errors/unknown-permission.error.js';
import { PermissionCode } from '../../domain/role/permission-code.vo.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import {
  ACTOR,
  TENANT_A,
  aRole,
  aTenant,
  anActingAdministrator,
} from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

// Quien crea es un administrador: nada de lo que reparte queda fuera de su alcance, asi
// que estas pruebas miden las reglas del rol y no las de quien lo crea.
const actor = anActingAdministrator();

function aScenario(roles: ReturnType<typeof aRole>[] = []) {
  return anAccessScenario({
    tenants: [aTenant()],
    users: [actor.user],
    memberships: [actor.membership],
    roles: [actor.role, ...roles],
  });
}

// El rol del actor tambien vive en la empresa, asi que las pruebas piden el suyo por
// nombre en vez de fiarse de la posicion.
async function rolesCreatedIn(scenario: ReturnType<typeof anAccessScenario>) {
  const all = await scenario.roles.searchByTenant(TenantId.of(TENANT_A));

  return all.filter((role) => !role.id.equals(actor.role.id));
}

function creatorFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new RoleCreator(
    scenario.roles,
    scenario.catalog,
    scenario.ids,
    scenario.authority,
    scenario.clock,
  );
}

describe('RoleCreator', () => {
  it('creates a role with the permissions asked for', async () => {
    const scenario = aScenario();

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
        actorId: ACTOR,
      name: 'Ventas',
      permissions: ['access.users.search'],
    });

    const [role] = await rolesCreatedIn(scenario);

    expect(role.toPrimitives().name).toBe('Ventas');
    expect(role.grants(PermissionCode.of('access.users.search'))).toBe(true);
  });

  // Esta prueba defendia lo contrario: daba por bueno el rol vacio. Un rol sin nada
  // marcado no da acceso a nada, y quien lo asigna cree estar dando algo.
  it('refuses to create a role with no permissions at all', async () => {
    const scenario = aScenario();

    await expect(
      creatorFor(scenario).run({ tenantId: TENANT_A, actorId: ACTOR, name: 'Sin permisos', permissions: [] }),
    ).rejects.toThrow(RoleWithoutPermissionsError);

    expect(await rolesCreatedIn(scenario)).toEqual([]);
  });

  // Dos roles homonimos en una empresa harian imposible saber cual se asigna.
  it('rejects a name already used in the tenant', async () => {
    const scenario = aScenario([aRole({ name: 'Ventas' })]);

    await expect(
      creatorFor(scenario).run({ tenantId: TENANT_A, actorId: ACTOR, name: 'Ventas', permissions: ['access.users.search'] }),
    ).rejects.toThrow(DuplicateRoleNameError);
  });

  // Conceder un permiso inexistente reventaria contra la clave ajena de la base.
  it('rejects a permission that is not in the catalog', async () => {
    const scenario = aScenario();

    await expect(
      creatorFor(scenario).run({
        tenantId: TENANT_A,
        actorId: ACTOR,
        name: 'Ventas',
        permissions: ['ventas.borrar.todo'],
      }),
    ).rejects.toThrow(UnknownPermissionError);
  });

  it('creates nothing when a permission is invalid', async () => {
    const scenario = aScenario();

    await expect(
      creatorFor(scenario).run({ tenantId: TENANT_A, actorId: ACTOR, name: 'Ventas', permissions: ['nope.nope'] }),
    ).rejects.toThrow();

    expect(await rolesCreatedIn(scenario)).toEqual([]);
  });

  it('ignores a permission sent twice', async () => {
    const scenario = aScenario();

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
        actorId: ACTOR,
      name: 'Ventas',
      permissions: ['access.users.search', 'access.users.search'],
    });

    const [role] = await rolesCreatedIn(scenario);

    expect(role.permissionCodes()).toHaveLength(1);
  });
});
