import { describe, expect, it } from 'vitest';
import { Email } from './email.vo.js';
import { PasswordHash } from './password-hash.vo.js';
import { User } from './user.entity.js';
import { UserName } from './user-name.vo.js';
import { NOW, USER_A, VALID_HASH, aUser } from '../testing/access.mother.js';

const LATER = new Date('2026-02-01T10:00:00.000Z');

describe('User', () => {
  it('is born active', () => {
    expect(aUser().isActive()).toBe(true);
  });

  it('survives a round trip through primitives', () => {
    const primitives = aUser().toPrimitives();

    expect(User.fromPrimitives(primitives).toPrimitives()).toEqual(primitives);
  });

  it('stamps the change date when the email changes', () => {
    const user = aUser();

    user.changeEmail(Email.of('nueva@acme.com'), LATER);

    expect(user.toPrimitives().email).toBe('nueva@acme.com');
    expect(user.toPrimitives().updatedAt).toEqual(LATER);
    expect(user.toPrimitives().createdAt).toEqual(NOW);
  });

  it('keeps its identity when its data changes', () => {
    const user = aUser();

    user.rename(UserName.of('Ana Maria'), LATER);

    expect(user.id.value).toBe(USER_A);
    expect(user.toPrimitives().name).toBe('Ana Maria');
  });

  it('can be deactivated and reactivated', () => {
    const user = aUser();

    user.deactivate(LATER);
    expect(user.isActive()).toBe(false);

    user.activate(LATER);
    expect(user.isActive()).toBe(true);
  });

  // La mitad de dominio de "cambiar la contrasena cierra las sesiones abiertas": el
  // guardian pregunta esto en cada peticion con el `iat` del token.
  describe('open sessions', () => {
    const SECOND = 1000;
    const issuedAt = (date: Date) => date.getTime();

    it('accepts a session issued after the last password change', () => {
      const user = aUser();
      user.changePassword(PasswordHash.of(VALID_HASH), NOW);

      expect(user.acceptsSessionIssuedAt(issuedAt(new Date(NOW.getTime() + SECOND)))).toBe(true);
    });

    it('refuses a session issued before it', () => {
      const user = aUser();
      user.changePassword(PasswordHash.of(VALID_HASH), NOW);

      expect(user.acceptsSessionIssuedAt(issuedAt(new Date(NOW.getTime() - SECOND)))).toBe(false);
    });

    // El token que se reemite en el mismo instante del cambio tiene que valer, o quien
    // cambia su contrasena se echaria a si mismo.
    it('accepts a session issued at the very same instant', () => {
      const user = aUser();
      user.changePassword(PasswordHash.of(VALID_HASH), NOW);

      expect(user.acceptsSessionIssuedAt(issuedAt(NOW))).toBe(true);
    });

    it('closes every open session on demand', () => {
      const user = aUser();
      const before = issuedAt(NOW);

      user.closeOpenSessions(new Date(NOW.getTime() + 10 * SECOND));

      expect(user.acceptsSessionIssuedAt(before)).toBe(false);
    });
  });
});
