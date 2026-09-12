import { beforeEach, describe, expect, it } from 'vitest';
import { UserAuthenticator } from './user-authenticator.js';
import { InactiveMembershipError } from '../../domain/errors/inactive-membership.error.js';
import { InactiveTenantError } from '../../domain/errors/inactive-tenant.error.js';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error.js';
import { TooManyLoginAttemptsError } from '../../domain/errors/too-many-login-attempts.error.js';
import { PasswordHash } from '../../domain/user/password-hash.vo.js';
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
import { FakePasswordHasher } from '../../infrastructure/testing/fake-password-hasher.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const PASSWORD = 'a-very-secret-password';
const OTHER_MEMBERSHIP = '77777777-7777-4777-8777-777777777777';

async function hashed(): Promise<PasswordHash> {
  return PasswordHash.of(await new FakePasswordHasher().hash(PASSWORD));
}

describe('UserAuthenticator', () => {
  let hash: PasswordHash;

  beforeEach(async () => {
    hash = await hashed();
  });

  function scenarioWithOneTenant(overrides: Parameters<typeof aTenant>[0] = {}) {
    const user = aUser();
    user.changePassword(hash, new Date());

    return anAccessScenario({
      users: [user],
      tenants: [aTenant(overrides)],
      roles: [aRole({ permissions: ['sales.invoices.create'] })],
      memberships: [aMembership({ roleIds: [ROLE_A] })],
    });
  }

  function scenarioWithTwoTenants() {
    const user = aUser();
    user.changePassword(hash, new Date());

    return anAccessScenario({
      users: [user],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      memberships: [
        aMembership(),
        aMembership({ id: OTHER_MEMBERSHIP, tenantId: TENANT_B }),
      ],
    });
  }

  function authenticatorFor(scenario: ReturnType<typeof anAccessScenario>) {
    return new UserAuthenticator(
      scenario.users,
      scenario.tenants,
      scenario.memberships,
      scenario.hasher,
      scenario.session,
      scenario.attempts,
    );
  }

  it('returns the session of the only tenant the user belongs to', async () => {
    const scenario = scenarioWithOneTenant();

    const session = await authenticatorFor(scenario).run({
      email: 'ana@acme.com',
      password: PASSWORD,
    });

    expect(session.userId).toBe(USER_A);
    expect(session.tenantId).toBe(TENANT_A);
    expect(session.permissions).toEqual(['sales.invoices.create']);
    expect(session.availableTenants).toHaveLength(1);
  });

  it('accepts the email in any case, because it is normalized', async () => {
    const scenario = scenarioWithOneTenant();

    const session = await authenticatorFor(scenario).run({
      email: '  ANA@Acme.com ',
      password: PASSWORD,
    });

    expect(session.email).toBe('ana@acme.com');
  });

  it('rejects a wrong password', async () => {
    const scenario = scenarioWithOneTenant();

    await expect(
      authenticatorFor(scenario).run({ email: 'ana@acme.com', password: 'wrong' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  // Un correo que no existe y una contrasena mala responden lo mismo: no se le dice
  // al atacante que cuentas hay registradas.
  it('rejects an unknown email with the very same error', async () => {
    const scenario = scenarioWithOneTenant();

    await expect(
      authenticatorFor(scenario).run({ email: 'nadie@acme.com', password: PASSWORD }),
    ).rejects.toThrow(/Invalid credentials/);
  });

  it('rejects a member of a suspended tenant', async () => {
    const scenario = scenarioWithOneTenant({ active: false });

    await expect(
      authenticatorFor(scenario).run({ email: 'ana@acme.com', password: PASSWORD }),
    ).rejects.toThrow(InactiveTenantError);
  });

  function scenarioWithRevokedMembership() {
    const user = aUser();
    user.changePassword(hash, new Date());

    return anAccessScenario({
      users: [user],
      tenants: [aTenant()],
      memberships: [aMembership({ active: false })],
    });
  }

  // Sin empresa pedida, elegir es cosa del sistema: una membresia revocada no entra
  // en la eleccion y el rechazo no dice por que, igual que un correo inexistente.
  it('rejects a revoked membership without saying why when no tenant is asked for', async () => {
    await expect(
      authenticatorFor(scenarioWithRevokedMembership()).run({
        email: 'ana@acme.com',
        password: PASSWORD,
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  // Pidiendo la empresa expresamente si se dice: quien ya sabe que existe merece
  // saber que su acceso fue revocado, no que su contrasena esta mal.
  it('tells a revoked member so when the tenant is asked for by slug', async () => {
    await expect(
      authenticatorFor(scenarioWithRevokedMembership()).run({
        email: 'ana@acme.com',
        password: PASSWORD,
        tenantSlug: 'acme',
      }),
    ).rejects.toThrow(InactiveMembershipError);
  });

  it('enters the tenant asked for by slug when the user belongs to several', async () => {
    const scenario = scenarioWithTwoTenants();

    const session = await authenticatorFor(scenario).run({
      email: 'ana@acme.com',
      password: PASSWORD,
      tenantSlug: 'globex',
    });

    expect(session.tenantId).toBe(TENANT_B);
    expect(session.availableTenants).toHaveLength(2);
  });

  it('enters the first tenant when none is asked for', async () => {
    const scenario = scenarioWithTwoTenants();

    const session = await authenticatorFor(scenario).run({
      email: 'ana@acme.com',
      password: PASSWORD,
    });

    expect(session.tenantId).toBe(TENANT_A);
  });

  it('rejects a tenant slug that does not exist without confirming it', async () => {
    const scenario = scenarioWithOneTenant();

    await expect(
      authenticatorFor(scenario).run({
        email: 'ana@acme.com',
        password: PASSWORD,
        tenantSlug: 'unknown-company',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  // Pertenecer a una empresa no da acceso a las demas, y el rechazo no confirma que
  // la otra empresa exista.
  it('rejects a tenant the user does not belong to', async () => {
    const user = aUser();
    user.changePassword(hash, new Date());
    const scenario = anAccessScenario({
      users: [user],
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      memberships: [aMembership()],
    });

    await expect(
      authenticatorFor(scenario).run({
        email: 'ana@acme.com',
        password: PASSWORD,
        tenantSlug: 'globex',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  // Fuerza bruta: tras cinco fallos, ni la contrasena correcta entra.
  it('locks the account after five failed attempts, even for the right password', async () => {
    const scenario = scenarioWithOneTenant();
    const authenticator = authenticatorFor(scenario);

    for (let i = 0; i < 5; i++) {
      await expect(
        authenticator.run({ email: 'ana@acme.com', password: 'wrong' }),
      ).rejects.toThrow(InvalidCredentialsError);
    }

    await expect(
      authenticator.run({ email: 'ana@acme.com', password: PASSWORD }),
    ).rejects.toThrow(TooManyLoginAttemptsError);
  });

  it('forgets the failures after a successful sign in', async () => {
    const scenario = scenarioWithOneTenant();
    const authenticator = authenticatorFor(scenario);

    for (let i = 0; i < 4; i++) {
      await expect(authenticator.run({ email: 'ana@acme.com', password: 'wrong' })).rejects.toThrow();
    }
    await authenticator.run({ email: 'ana@acme.com', password: PASSWORD });

    for (let i = 0; i < 4; i++) {
      await expect(authenticator.run({ email: 'ana@acme.com', password: 'wrong' })).rejects.toThrow(
        InvalidCredentialsError,
      );
    }
  });

  // Tambien cuenta correos inexistentes: si no, bloquear delataria cuales existen.
  it('locks an unknown email just the same', async () => {
    const scenario = scenarioWithOneTenant();
    const authenticator = authenticatorFor(scenario);

    for (let i = 0; i < 5; i++) {
      await expect(authenticator.run({ email: 'nadie@acme.com', password: 'x' })).rejects.toThrow();
    }

    await expect(authenticator.run({ email: 'nadie@acme.com', password: 'x' })).rejects.toThrow(
      TooManyLoginAttemptsError,
    );
  });
});
