import { describe, expect, it } from 'vitest';
import { TenantUserUpdater } from './tenant-user-updater.js';
import { MembershipNotFoundError } from '../../domain/errors/membership-not-found.error.js';
import { CannotDropOwnAdminRoleError } from '../../domain/errors/cannot-drop-own-admin-role.error.js';
import { CannotGrantSelfMoreAccessError } from '../../domain/errors/cannot-grant-self-more-access.error.js';
import { LastAdministratorError } from '../../domain/errors/last-administrator.error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import {
  ROLE_A,
  TENANT_A,
  TENANT_B,
  USER_A,
  aMembership,
  aRole,
  aTenant,
  aUser,
  anActingAdministrator,
  anActingSupervisor,
  anAdminRole,
} from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';
// Quien edita, cuando no es la propia persona: un administrador cambiando a otro.
const actor = anActingAdministrator();
const OTHER_USER = actor.user.id.value;

function updaterFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new TenantUserUpdater(
    scenario.membershipFinder,
    scenario.userFinder,
    scenario.roleFinder,
    scenario.users,
    scenario.memberships,
    scenario.administration,
    scenario.authority,
    scenario.clock,
  );
}

function aScenario() {
  return anAccessScenario({
    users: [actor.user, aUser()],
    tenants: [aTenant()],
    roles: [actor.role, aRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
    memberships: [actor.membership, aMembership({ roleIds: [ROLE_A] })],
  });
}

describe('TenantUserUpdater', () => {
  it('renames the person and replaces the roles checked', async () => {
    const scenario = aScenario();

    await updaterFor(scenario).run({
      tenantId: TENANT_A,
      actorId: OTHER_USER,
      userId: USER_A,
      name: 'Ana Maria',
      roleIds: [OTHER_ROLE],
    });

    const user = await scenario.users.find(UserId.of(USER_A));
    const membership = await scenario.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));
    expect(user!.toPrimitives().name).toBe('Ana Maria');
    expect(membership!.roles().map((role) => role.value)).toEqual([OTHER_ROLE]);
  });

  // La otra mitad de "no puedes desactivarte": quitarte la administracion deja igual de fuera,
  // y si eras el unico administrador nadie puede devolver el acceso.
  it('refuses to let someone take away their own administrator role', async () => {
    const scenario = anAccessScenario({
      users: [actor.user, aUser()],
      tenants: [aTenant()],
      roles: [actor.role, anAdminRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
      memberships: [actor.membership, aMembership({ roleIds: [ROLE_A] })],
    });

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, actorId: USER_A, userId: USER_A, name: 'Ana', roleIds: [] }),
    ).rejects.toThrow(CannotDropOwnAdminRoleError);
    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, actorId: USER_A, userId: USER_A, name: 'Ana', roleIds: [OTHER_ROLE] }),
    ).rejects.toThrow(CannotDropOwnAdminRoleError);

    const membership = await scenario.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));
    expect(membership!.roles().map((role) => role.value)).toEqual([ROLE_A]);
  });

  // Cambiarse el nombre o anadirse roles sigue permitido: lo que se protege es no quedarse sin
  // la administracion, no tocarse a uno mismo.
  it('lets an administrator rename themselves and keep administering', async () => {
    const scenario = anAccessScenario({
      users: [actor.user, aUser()],
      tenants: [aTenant()],
      roles: [actor.role, anAdminRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
      memberships: [actor.membership, aMembership({ roleIds: [ROLE_A] })],
    });

    await updaterFor(scenario).run({ tenantId: TENANT_A, actorId: USER_A, userId: USER_A, name: 'Ana Maria', roleIds: [ROLE_A, OTHER_ROLE] });

    const membership = await scenario.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));
    expect(membership!.roles().map((role) => role.value)).toEqual([ROLE_A, OTHER_ROLE]);
  });

  it('removes every role when none is checked', async () => {
    const scenario = aScenario();

    await updaterFor(scenario).run({ tenantId: TENANT_A, actorId: OTHER_USER, userId: USER_A, name: 'Ana', roleIds: [] });

    const membership = await scenario.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));
    expect(membership!.roles()).toEqual([]);
  });

  // Nunca toca la llave de la cuenta, que tambien abre otras empresas.
  it('never changes the email or the password', async () => {
    const scenario = aScenario();
    const before = (await scenario.users.find(UserId.of(USER_A)))!.toPrimitives();

    await updaterFor(scenario).run({ tenantId: TENANT_A, actorId: OTHER_USER, userId: USER_A, name: 'Otro', roleIds: [] });

    const after = (await scenario.users.find(UserId.of(USER_A)))!.toPrimitives();
    expect(after.email).toBe(before.email);
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  // Aislamiento: no se edita a quien no esta en la empresa, ni se confirma que exista.
  it('rejects a person who does not belong to the tenant', async () => {
    const scenario = anAccessScenario({
      users: [actor.user, aUser()],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      memberships: [actor.membership, aMembership({ tenantId: TENANT_B })],
    });

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, actorId: OTHER_USER, userId: USER_A, name: 'Colado', roleIds: [] }),
    ).rejects.toThrow(MembershipNotFoundError);

    expect((await scenario.users.find(UserId.of(USER_A)))!.toPrimitives().name).toBe('Ana');
  });

  it('changes nothing when a role is invalid', async () => {
    const scenario = aScenario();

    await expect(
      updaterFor(scenario).run({
        tenantId: TENANT_A,
        actorId: OTHER_USER,
        userId: USER_A,
        name: 'No deberia',
        roleIds: ['99999999-9999-4999-8999-999999999999'],
      }),
    ).rejects.toThrow(RoleNotFoundError);

    expect((await scenario.users.find(UserId.of(USER_A)))!.toPrimitives().name).toBe('Ana');
  });

  // La guarda de arriba solo miraba el caso propio: otra persona podia quitarle la
  // administracion al ultimo que quedaba y dejar a la empresa sin gobierno.
  describe('the last administrator', () => {
    const SECOND_ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const SECOND_MEMBERSHIP = '77777777-7777-4777-8777-777777777777';
    // Quien edita NO administra: si administrara, nunca seria el ultimo. Quitar un rol no
    // pide alcance —solo concederlo lo pide—, asi que puede intentarlo igual.
    const supervisor = anActingSupervisor();

    it('refuses to let anyone take it from the only one left', async () => {
      const scenario = anAccessScenario({
        users: [supervisor.user, aUser()],
        tenants: [aTenant()],
        roles: [supervisor.role, anAdminRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
        memberships: [supervisor.membership, aMembership({ roleIds: [ROLE_A] })],
      });

      await expect(
        updaterFor(scenario).run({
          tenantId: TENANT_A,
          actorId: supervisor.user.id.value,
          userId: USER_A,
          name: 'Ana',
          roleIds: [],
        }),
      ).rejects.toThrow(LastAdministratorError);

      const membership = await scenario.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));
      expect(membership!.roles().map((role) => role.value)).toEqual([ROLE_A]);
    });

    it('allows it while somebody else still administers', async () => {
      const scenario = anAccessScenario({
        users: [supervisor.user, aUser(), aUser({ id: SECOND_ADMIN, email: 'beto@acme.com' })],
        tenants: [aTenant()],
        roles: [supervisor.role, anAdminRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
        memberships: [
          supervisor.membership,
          aMembership({ roleIds: [ROLE_A] }),
          aMembership({ id: SECOND_MEMBERSHIP, userId: SECOND_ADMIN, roleIds: [ROLE_A] }),
        ],
      });

      await updaterFor(scenario).run({
        tenantId: TENANT_A,
        actorId: supervisor.user.id.value,
        userId: USER_A,
        name: 'Ana',
        roleIds: [],
      });

      const membership = await scenario.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));
      expect(membership!.roles()).toEqual([]);
    });

    // La puerta que quedaba abierta: con solo `access.users.update`, dar de alta el rol que
    // lo concede todo —a otro o a uno mismo— era ascender sin ser administrador.
    it('refuses to hand the administrator role to anyone when the actor is not one', async () => {
      const scenario = anAccessScenario({
        users: [supervisor.user, aUser()],
        tenants: [aTenant()],
        roles: [supervisor.role, anAdminRole()],
        memberships: [supervisor.membership, aMembership()],
      });

      await expect(
        updaterFor(scenario).run({
          tenantId: TENANT_A,
          actorId: supervisor.user.id.value,
          userId: USER_A,
          name: 'Ana',
          roleIds: [ROLE_A],
        }),
      ).rejects.toThrow(CannotGrantSelfMoreAccessError);
    });
  });
});
