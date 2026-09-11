import { describe, expect, it } from 'vitest';
import { UserCreator } from './user-creator.js';
import { DuplicateMembershipError } from '../../domain/errors/duplicate-membership.error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error.js';
import { TenantNotFoundError } from '../../domain/errors/tenant-not-found.error.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { Email } from '../../domain/user/email.vo.js';
import {
  NOW,
  ROLE_A,
  TENANT_A,
  TENANT_B,
  aMembership,
  aRole,
  aTenant,
  aUser,
} from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';
const ABSENT = '99999999-9999-4999-8999-999999999999';

function creatorFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new UserCreator(
    scenario.tenantFinder,
    scenario.roleFinder,
    scenario.registrar,
    scenario.enroller,
  );
}

function aScenario() {
  return anAccessScenario({ tenants: [aTenant()], roles: [aRole()] });
}

describe('UserCreator', () => {
  it('registers the person and ties it to the tenant', async () => {
    const scenario = aScenario();

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
      email: 'nueva@acme.com',
      password: 'a-secret',
      name: 'Nueva',
    });

    const user = await scenario.users.findByEmail(Email.of('nueva@acme.com'));
    expect(user).not.toBeNull();

    const memberships = await scenario.memberships.searchByTenant(TenantId.of(TENANT_A));
    expect(memberships).toHaveLength(1);
    expect(memberships[0].userId.equals(user!.id)).toBe(true);
  });

  // Lo guardado pasa por el hasher y por PasswordHash. Que el hash sea irreversible
  // es cosa de Argon2 y se prueba en su adaptador, no aqui.
  it('stores what the hasher returned, not the plain password', async () => {
    const scenario = aScenario();

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
      email: 'nueva@acme.com',
      password: 'a-secret',
      name: 'Nueva',
    });

    const stored = (await scenario.users.findByEmail(Email.of('nueva@acme.com')))!;
    const expected = await scenario.hasher.hash('a-secret');

    expect(stored.currentPasswordHash().value).toBe(expected);
    expect(stored.currentPasswordHash().value).not.toBe('a-secret');
  });

  it('stamps the moment given by the clock, not the real one', async () => {
    const scenario = aScenario();

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
      email: 'nueva@acme.com',
      password: 'a-secret',
      name: 'Nueva',
    });

    const stored = (await scenario.users.findByEmail(Email.of('nueva@acme.com')))!;
    expect(stored.toPrimitives().createdAt).toEqual(NOW);
  });

  // El caso que justifica que users no lleve tenantId: el mismo correo entra en una
  // segunda empresa sin duplicar la persona.
  it('reuses the person when the email already works somewhere else', async () => {
    const scenario = anAccessScenario({
      users: [aUser()],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      memberships: [aMembership()],
    });

    await creatorFor(scenario).run({
      tenantId: TENANT_B,
      email: 'ana@acme.com',
      password: 'another-secret',
      name: 'Ana',
    });

    const memberships = await scenario.memberships.searchByUser(aUser().id);
    expect(memberships).toHaveLength(2);
  });

  it('rejects adding the same person to the same tenant twice', async () => {
    const scenario = anAccessScenario({
      users: [aUser()],
      tenants: [aTenant()],
      memberships: [aMembership()],
    });

    await expect(
      creatorFor(scenario).run({
        tenantId: TENANT_A,
        email: 'ana@acme.com',
        password: 'a-secret',
        name: 'Ana',
      }),
    ).rejects.toThrow(DuplicateMembershipError);
  });

  it('assigns the roles asked for', async () => {
    const scenario = aScenario();

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
      email: 'nueva@acme.com',
      password: 'a-secret',
      name: 'Nueva',
      roleIds: [ROLE_A],
    });

    const memberships = await scenario.memberships.searchByTenant(TenantId.of(TENANT_A));
    expect(memberships[0].roles().map((role) => role.value)).toEqual([ROLE_A]);
  });

  // Aislamiento: un rol de otra empresa se responde como inexistente, no como prohibido.
  it('rejects a role that belongs to another tenant, as if it did not exist', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      roles: [aRole({ id: OTHER_ROLE, tenantId: TENANT_B })],
    });

    await expect(
      creatorFor(scenario).run({
        tenantId: TENANT_A,
        email: 'nueva@acme.com',
        password: 'a-secret',
        name: 'Nueva',
        roleIds: [OTHER_ROLE],
      }),
    ).rejects.toThrow(RoleNotFoundError);
  });

  it('rejects a tenant that does not exist', async () => {
    await expect(
      creatorFor(aScenario()).run({
        tenantId: ABSENT,
        email: 'nueva@acme.com',
        password: 'a-secret',
        name: 'Nueva',
      }),
    ).rejects.toThrow(TenantNotFoundError);
  });

  // Se valida ANTES de tocar nada: un fallo a mitad dejaria una persona sin empresa.
  it('creates nothing when a role is invalid', async () => {
    const scenario = aScenario();

    await expect(
      creatorFor(scenario).run({
        tenantId: TENANT_A,
        email: 'nueva@acme.com',
        password: 'a-secret',
        name: 'Nueva',
        roleIds: [ABSENT],
      }),
    ).rejects.toThrow(RoleNotFoundError);

    expect(await scenario.users.findByEmail(Email.of('nueva@acme.com'))).toBeNull();
  });
});
