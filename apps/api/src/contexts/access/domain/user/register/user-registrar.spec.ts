import { describe, expect, it } from 'vitest';
import { UserRegistrar } from './user-registrar.js';
import { NOW, USER_A, aUser } from '../../testing/access.mother.js';
import { FakePasswordHasher } from '../../../infrastructure/testing/fake-password-hasher.js';
import { FixedClock } from '../../../infrastructure/testing/fixed-clock.js';
import { InMemoryUserRepository } from '../../../infrastructure/testing/in-memory-user.repository.js';
import { SequentialIdGenerator } from '../../../infrastructure/testing/sequential-id-generator.js';
import { Email } from '../email.vo.js';
import { UserName } from '../user-name.vo.js';

const PASSWORD = 'a-secret-password';

function registrarWith(seed: ReturnType<typeof aUser>[] = []) {
  const users = new InMemoryUserRepository(seed);
  const hasher = new FakePasswordHasher();

  return {
    users,
    hasher,
    registrar: new UserRegistrar(
      users,
      hasher,
      new SequentialIdGenerator(),
      new FixedClock(NOW),
    ),
  };
}

describe('UserRegistrar', () => {
  it('registers a person that did not exist', async () => {
    const { registrar, users } = registrarWith();

    const user = await registrar.register(
      Email.of('nueva@acme.com'),
      PASSWORD,
      UserName.of('Nueva'),
    );

    expect(await users.find(user.id)).not.toBeNull();
    expect(user.toPrimitives().createdAt).toEqual(NOW);
  });

  it('stores the hash the hasher returned, never the plain password', async () => {
    const { registrar, hasher } = registrarWith();

    const user = await registrar.register(
      Email.of('nueva@acme.com'),
      PASSWORD,
      UserName.of('Nueva'),
    );

    expect(user.currentPasswordHash().value).toBe(await hasher.hash(PASSWORD));
    expect(user.currentPasswordHash().value).not.toBe(PASSWORD);
  });

  // El caso que justifica que `users` no lleve tenantId: el contador que trabaja en
  // dos empresas es UNA persona, no dos cuentas con el mismo correo.
  it('reuses the person when the email is already registered', async () => {
    const { registrar, users } = registrarWith([aUser()]);

    const user = await registrar.register(
      Email.of('ana@acme.com'),
      'a-different-password',
      UserName.of('Ana'),
    );

    expect(user.id.value).toBe(USER_A);
    expect(await users.searchByIds([user.id])).toHaveLength(1);
  });

  // Reutilizar no es reescribir: la contrasena de la persona no la cambia quien la
  // da de alta en una segunda empresa.
  it('does not overwrite the password of the person it reuses', async () => {
    const { registrar } = registrarWith([aUser()]);
    const original = aUser().currentPasswordHash().value;

    const user = await registrar.register(
      Email.of('ana@acme.com'),
      'a-different-password',
      UserName.of('Ana'),
    );

    expect(user.currentPasswordHash().value).toBe(original);
  });

  it('matches the email ignoring case, so it does not duplicate', async () => {
    const { registrar } = registrarWith([aUser()]);

    const user = await registrar.register(
      Email.of('ANA@Acme.com'),
      PASSWORD,
      UserName.of('Ana'),
    );

    expect(user.id.value).toBe(USER_A);
  });
});
