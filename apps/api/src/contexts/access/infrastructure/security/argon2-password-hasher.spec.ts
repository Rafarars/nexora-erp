import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { PasswordHash } from '../../domain/user/password-hash.vo.js';

const hasher = new Argon2PasswordHasher();
const PASSWORD = 'a-secret-password';

// Argon2 tarda cientos de milisegundos POR DISENO: encarecer la fuerza bruta es su
// razon de ser. Por eso las pruebas de aplicacion usan un doble.
describe('Argon2PasswordHasher', () => {
  it('verifies the password it hashed', async () => {
    expect(await hasher.verify(PASSWORD, await hasher.hash(PASSWORD))).toBe(true);
  });

  it('rejects a wrong password', async () => {
    expect(await hasher.verify('another-password', await hasher.hash(PASSWORD))).toBe(false);
  });

  // Salt aleatorio: dos personas con la misma contrasena no comparten hash, asi que
  // romper uno no rompe el otro.
  it('produces a different hash every time for the same password', async () => {
    expect(await hasher.hash(PASSWORD)).not.toBe(await hasher.hash(PASSWORD));
  });

  it('produces a hash the domain accepts', async () => {
    const value = await hasher.hash(PASSWORD);

    expect(PasswordHash.of(value).value).toBe(value);
    expect(value.startsWith('$argon2')).toBe(true);
  });

  // Un hash corrupto no puede reventar el login con un 500.
  it('answers false instead of throwing on a malformed hash', async () => {
    expect(await hasher.verify(PASSWORD, 'not-a-hash')).toBe(false);
  });

  it('does not accept an empty password as valid', async () => {
    expect(await hasher.verify('', await hasher.hash(PASSWORD))).toBe(false);
  });
});
