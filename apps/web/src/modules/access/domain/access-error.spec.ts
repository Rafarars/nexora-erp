import { describe, expect, it } from 'vitest';
import { AccessError, readableError } from './access-error';

const FALLBACK = 'No se pudo completar la operación.';

describe('readableError', () => {
  it('translates a known error code', () => {
    const error = AccessError.fromStatus(409, { code: 'DuplicateRoleNameError' });

    expect(readableError(error, FALLBACK)).toBe('Ya existe un rol con ese nombre.');
  });

  // El caso que motivo el cambio: el texto tecnico de zod llegaba a la pantalla.
  it('never shows the technical message of the API', () => {
    const error = AccessError.fromStatus(400, {
      code: 'ValidationError',
      message: 'password: Too small: expected string to have >=8 characters',
      fields: ['password'],
    });

    const shown = readableError(error, FALLBACK);

    expect(shown).toBe('La contraseña debe tener al menos 8 caracteres.');
    expect(shown).not.toContain('Too small');
  });

  it('uses the first field it knows how to explain', () => {
    const error = AccessError.fromStatus(400, { fields: ['roleIds', 'email', 'name'] });

    expect(readableError(error, FALLBACK)).toBe('Escribe un correo válido.');
  });

  // Antes el cambio de contrasena decia "Correo o contrasena incorrectos" en un
  // formulario sin correo.
  it('tells apart a wrong current password from a failed sign in', () => {
    const wrongCurrent = AccessError.fromStatus(400, { code: 'WrongCurrentPasswordError' });
    const signIn = AccessError.fromStatus(401, { code: 'InvalidCredentialsError' });

    expect(readableError(wrongCurrent, FALLBACK)).toBe('La contraseña actual no es correcta.');
    expect(readableError(signIn, FALLBACK)).toBe('Correo o contraseña incorrectos.');
  });

  it('tells a person with no active access why they cannot enter', () => {
    const error = AccessError.fromStatus(401, { code: 'NoActiveMembershipError' });

    expect(readableError(error, FALLBACK)).toContain('no tiene acceso activo');
  });

  it('falls back to the category for an unknown code', () => {
    const error = AccessError.fromStatus(403, { code: 'SomethingNewError' });

    expect(readableError(error, FALLBACK)).toBe('Tu rol no te permite hacer esto.');
  });

  it('uses the fallback for something that is not an access error', () => {
    expect(readableError(new Error('boom'), FALLBACK)).toBe(FALLBACK);
  });

  it('uses the fallback for an unexpected status', () => {
    expect(readableError(AccessError.fromStatus(502), FALLBACK)).toBe(FALLBACK);
  });
});
