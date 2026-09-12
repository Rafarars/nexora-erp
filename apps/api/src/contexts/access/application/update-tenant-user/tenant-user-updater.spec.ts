import { describe, expect, it } from 'vitest';
import { TenantUserUpdater } from './tenant-user-updater.js';
import { MembershipNotFoundError } from '../../domain/errors/membership-not-found.error.js';
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
} from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';

function updaterFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new TenantUserUpdater(
    scenario.membershipFinder,
    scenario.userFinder,
    scenario.roleFinder,
    scenario.users,
    scenario.memberships,
    scenario.clock,
  );
}

function aScenario() {
  return anAccessScenario({
    users: [aUser()],
    tenants: [aTenant()],
    roles: [aRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
    memberships: [aMembership({ roleIds: [ROLE_A] })],
  });
}

describe('TenantUserUpdater', () => {
  it('renames the person and replaces the roles checked', async () => {
    const scenario = aScenario();

    await updaterFor(scenario).run({
      tenantId: TENANT_A,
      userId: USER_A,
      name: 'Ana Maria',
      roleIds: [OTHER_ROLE],
    });

    const user = await scenario.users.find(UserId.of(USER_A));
    const membership = await scenario.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));
    expect(user!.toPrimitives().name).toBe('Ana Maria');
    expect(membership!.roles().map((role) => role.value)).toEqual([OTHER_ROLE]);
  });

  it('removes every role when none is checked', async () => {
    const scenario = aScenario();

    await updaterFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, name: 'Ana', roleIds: [] });

    const membership = await scenario.memberships.findByUser(TenantId.of(TENANT_A), UserId.of(USER_A));
    expect(membership!.roles()).toEqual([]);
  });

  // Nunca toca la llave de la cuenta, que tambien abre otras empresas.
  it('never changes the email or the password', async () => {
    const scenario = aScenario();
    const before = (await scenario.users.find(UserId.of(USER_A)))!.toPrimitives();

    await updaterFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, name: 'Otro', roleIds: [] });

    const after = (await scenario.users.find(UserId.of(USER_A)))!.toPrimitives();
    expect(after.email).toBe(before.email);
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  // Aislamiento: no se edita a quien no esta en la empresa, ni se confirma que exista.
  it('rejects a person who does not belong to the tenant', async () => {
    const scenario = anAccessScenario({
      users: [aUser()],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      memberships: [aMembership({ tenantId: TENANT_B })],
    });

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, name: 'Colado', roleIds: [] }),
    ).rejects.toThrow(MembershipNotFoundError);

    expect((await scenario.users.find(UserId.of(USER_A)))!.toPrimitives().name).toBe('Ana');
  });

  it('changes nothing when a role is invalid', async () => {
    const scenario = aScenario();

    await expect(
      updaterFor(scenario).run({
        tenantId: TENANT_A,
        userId: USER_A,
        name: 'No deberia',
        roleIds: ['99999999-9999-4999-8999-999999999999'],
      }),
    ).rejects.toThrow(RoleNotFoundError);

    expect((await scenario.users.find(UserId.of(USER_A)))!.toPrimitives().name).toBe('Ana');
  });
});
