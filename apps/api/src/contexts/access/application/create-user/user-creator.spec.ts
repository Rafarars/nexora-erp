import { describe, expect, it } from 'vitest';
import { UserCreator } from './user-creator.js';
import { DuplicateMembershipError } from '../../domain/errors/duplicate-membership.error.js';
import { CannotGrantSelfMoreAccessError } from '../../domain/errors/cannot-grant-self-more-access.error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error.js';
import { TenantNotFoundError } from '../../domain/errors/tenant-not-found.error.js';
import { WeakPasswordError } from '../../domain/user/plain-password.vo.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { Email } from '../../domain/user/email.vo.js';
import {
  ACTOR,
  NOW,
  ROLE_A,
  TENANT_A,
  TENANT_B,
  aMembership,
  aRole,
  aTenant,
  aUser,
  anActingAdministrator,
  anActingSupervisor,
  anAdminRole,
} from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

// Quien da el alta administra: nada de lo que reparte queda fuera de su alcance.
const actor = anActingAdministrator();
// El mismo actor administrando Globex, para las altas que ocurren alli.
const inGlobex = anActingAdministrator(TENANT_B);
const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';
const ABSENT = '99999999-9999-4999-8999-999999999999';

// La membresia del actor tambien vive en la empresa: las pruebas miran las que crea el
// caso de uso, no la suya.
async function membershipsCreatedIn(
  scenario: ReturnType<typeof anAccessScenario>,
  tenantId = TENANT_A,
) {
  const all = await scenario.memberships.searchByTenant(TenantId.of(tenantId));

  return all.filter((membership) => !membership.userId.equals(actor.user.id));
}

function creatorFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new UserCreator(
    scenario.tenantFinder,
    scenario.roleFinder,
    scenario.registrar,
    scenario.enroller,
    scenario.authority,
  );
}

function aScenario() {
  return anAccessScenario({
    tenants: [aTenant()],
    users: [actor.user],
    memberships: [actor.membership],
    roles: [actor.role, aRole()],
  });
}

describe('UserCreator', () => {
  it('registers the person and ties it to the tenant', async () => {
    const scenario = aScenario();

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
      actorId: ACTOR,
      email: 'nueva@acme.com',
      password: 'a-secret',
      name: 'Nueva',
    });

    const user = await scenario.users.findByEmail(Email.of('nueva@acme.com'));
    expect(user).not.toBeNull();

    const memberships = await membershipsCreatedIn(scenario);
    expect(memberships).toHaveLength(1);
    expect(memberships[0].userId.equals(user!.id)).toBe(true);
  });

  // Lo guardado pasa por el hasher y por PasswordHash. Que el hash sea irreversible
  // es cosa de Argon2 y se prueba en su adaptador, no aqui.
  it('stores what the hasher returned, not the plain password', async () => {
    const scenario = aScenario();

    await creatorFor(scenario).run({
      tenantId: TENANT_A,
      actorId: ACTOR,
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
      actorId: ACTOR,
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
      users: [actor.user, aUser()],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      roles: [actor.role, inGlobex.role],
      memberships: [actor.membership, inGlobex.membership, aMembership()],
    });

    await creatorFor(scenario).run({
      tenantId: TENANT_B,
      actorId: ACTOR,
      email: 'ana@acme.com',
      password: 'another-secret',
      name: 'Ana',
    });

    const memberships = await scenario.memberships.searchByUser(aUser().id);
    expect(memberships).toHaveLength(2);
  });

  it('rejects adding the same person to the same tenant twice', async () => {
    const scenario = anAccessScenario({
      users: [actor.user, aUser()],
      tenants: [aTenant()],
      roles: [actor.role],
      memberships: [actor.membership, aMembership()],
    });

    await expect(
      creatorFor(scenario).run({
        tenantId: TENANT_A,
        actorId: ACTOR,
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
      actorId: ACTOR,
      email: 'nueva@acme.com',
      password: 'a-secret',
      name: 'Nueva',
      roleIds: [ROLE_A],
    });

    const [membership] = await membershipsCreatedIn(scenario);
    expect(membership.roles().map((role) => role.value)).toEqual([ROLE_A]);
  });

  // Aislamiento: un rol de otra empresa se responde como inexistente, no como prohibido.
  it('rejects a role that belongs to another tenant, as if it did not exist', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      roles: [actor.role, aRole({ id: OTHER_ROLE, tenantId: TENANT_B })],
    });

    await expect(
      creatorFor(scenario).run({
        tenantId: TENANT_A,
        actorId: ACTOR,
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
        actorId: ACTOR,
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
        actorId: ACTOR,
        email: 'nueva@acme.com',
        password: 'a-secret',
        name: 'Nueva',
        roleIds: [ABSENT],
      }),
    ).rejects.toThrow(RoleNotFoundError);

    expect(await scenario.users.findByEmail(Email.of('nueva@acme.com'))).toBeNull();
  });

  // Antes solo lo frenaba la validacion HTTP: el caso de uso aceptaba un caracter.
  it('rejects a password shorter than the minimum and creates nobody', async () => {
    const scenario = aScenario();

    await expect(
      creatorFor(scenario).run({
        tenantId: TENANT_A,
        actorId: ACTOR,
        email: 'corta@acme.com',
        password: 'x',
        name: 'Corta',
      }),
    ).rejects.toThrow(WeakPasswordError);

    expect(await scenario.users.findByEmail(Email.of('corta@acme.com'))).toBeNull();
  });

  // Reproducido contra la API: con `access.users.create` bastaba dar de alta una cuenta
  // con el rol que lo concede todo y entrar con ella.
  describe('handing out a role you do not have', () => {
    const supervisor = anActingSupervisor(['access.users.create']);

    it('refuses to create an account carrying the role that grants everything', async () => {
      const scenario = anAccessScenario({
        tenants: [aTenant()],
        users: [supervisor.user],
        memberships: [supervisor.membership],
        roles: [supervisor.role, anAdminRole()],
      });

      await expect(
        creatorFor(scenario).run({
          tenantId: TENANT_A,
          actorId: supervisor.user.id.value,
          email: 'titere@acme.com',
          password: 'a-long-password',
          name: 'Titere',
          roleIds: [ROLE_A],
        }),
      ).rejects.toThrow(CannotGrantSelfMoreAccessError);

      expect(await scenario.users.findByEmail(Email.of('titere@acme.com'))).toBeNull();
    });

    it('lets an administrator create one', async () => {
      const scenario = anAccessScenario({
        tenants: [aTenant()],
        users: [actor.user],
        memberships: [actor.membership],
        roles: [actor.role, anAdminRole()],
      });

      await creatorFor(scenario).run({
        tenantId: TENANT_A,
        actorId: ACTOR,
        email: 'segunda@acme.com',
        password: 'a-long-password',
        name: 'Segunda',
        roleIds: [ROLE_A],
      });

      expect(await scenario.users.findByEmail(Email.of('segunda@acme.com'))).not.toBeNull();
    });
  });
});
