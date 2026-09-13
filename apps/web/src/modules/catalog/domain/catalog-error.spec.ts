import { describe, expect, it } from 'vitest';
import { AccessError } from '../../access/domain/access-error';
import { readableCatalogError } from './catalog-error';

const FALLBACK = 'No se pudo guardar.';

describe('readableCatalogError', () => {
  it('explains a rule of the catalog in Spanish', () => {
    const error = AccessError.fromStatus(409, { code: 'CategoryInUseError', message: 'Category <x> is used.' });

    expect(readableCatalogError(error, FALLBACK)).toBe('No se puede desactivar: hay artículos activos en esta categoría.');
  });

  it('points at the units row instead of a JSON path', () => {
    const error = AccessError.fromStatus(400, { code: 'ValidationError', fields: ['units.1.conversionFactor'] });

    expect(readableCatalogError(error, FALLBACK)).toContain('Revisa las unidades');
  });

  it('explains a rate that is not a number', () => {
    const error = AccessError.fromStatus(400, { code: 'ValidationError', fields: ['rate'] });

    expect(readableCatalogError(error, FALLBACK)).toContain('porcentaje');
  });

  // Lo que no es del catalogo lo sigue explicando el modulo de acceso.
  it('falls back to the access translations', () => {
    const error = AccessError.fromStatus(403, { code: 'PermissionDeniedError' });

    expect(readableCatalogError(error, FALLBACK)).toBe('Tu rol no te permite hacer esto.');
  });

  it('never shows what the API sent', () => {
    const error = AccessError.fromStatus(404, { code: 'CategoryNotFoundError', message: 'Category <abc> does not exist.' });

    expect(readableCatalogError(error, FALLBACK)).not.toContain('abc');
  });

  it('uses the fallback for something that is not an API error', () => {
    expect(readableCatalogError(new Error('boom'), FALLBACK)).toBe(FALLBACK);
  });
});
