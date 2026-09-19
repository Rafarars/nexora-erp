import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AccessError, readableError } from './access-error';

// Dos errores nuevos llegaron a la interfaz sin traduccion y salieron como "Ese dato ya
// existe", que dice lo contrario de lo que pasaba. Se leen los nombres de los errores del
// API —mismo repositorio— para que crear uno obligue a escribir su mensaje en espanol.
const ERRORS = new URL('../../../../../api/src/contexts/access/domain/errors/', import.meta.url);

// Estos no llegan nunca a una pantalla: los lanza el guardian cuando una ruta esta mal
// declarada, y eso se arregla en el codigo, no leyendo un mensaje.
const NEVER_REACHES_A_SCREEN = ['UndeclaredEndpointError', 'ContradictoryDeclarationError'];

// Les basta el texto de su categoria: a quien mira la pantalla le da igual si lo que ya no
// existe era la persona, el rol o la empresa. Estar en esta lista es una decision, no un
// olvido: por eso hay que escribirlos aqui uno a uno.
const COVERED_BY_CATEGORY = [
  'MembershipNotFoundError',
  'RoleNotFoundError',
  'TenantNotFoundError',
  'UserNotFoundError',
];

describe('access error messages', () => {
  it('translates every access error the API can send', () => {
    const untranslated = readdirSync(ERRORS)
      .filter((file) => file.endsWith('.error.ts'))
      .map(
        (file) =>
          file
            .replace(/\.error\.ts$/, '')
            .split('-')
            .map((part) => part[0].toUpperCase() + part.slice(1))
            .join('') + 'Error',
      )
      .filter((name) => ![...NEVER_REACHES_A_SCREEN, ...COVERED_BY_CATEGORY].includes(name))
      // Categoria 'unknown' a proposito: asi el texto generico de la categoria no tapa a
      // un codigo sin traducir, y lo que vuelve es el ultimo recurso.
      .filter(
        (name) =>
          readableError(new AccessError('', 'unknown', name, []), 'SIN TRADUCIR') === 'SIN TRADUCIR',
      );

    expect(untranslated).toEqual([]);
  });
});
