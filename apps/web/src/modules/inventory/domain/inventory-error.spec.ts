import { describe, expect, it } from 'vitest';
import { AccessError } from '../../access/domain/access-error';
import { readableInventoryError } from './inventory-error';

const FALLBACK = 'No se pudo guardar.';

describe('readableInventoryError', () => {
  it('explains the zero stock guard in Spanish without the quantities of the API message', () => {
    const error = AccessError.fromStatus(409, { code: 'InsufficientStockError', message: 'Item <x> has 3 and 5 was requested.' });

    expect(readableInventoryError(error, FALLBACK)).toBe('No hay existencia suficiente para esta salida.');
  });

  it('points at the lines instead of a JSON path', () => {
    const error = AccessError.fromStatus(400, { code: 'ValidationError', fields: ['lines.0.quantity'] });

    expect(readableInventoryError(error, FALLBACK)).toContain('Revisa las líneas');
  });

  // Lo que el inventario hace cumplir en el catalogo tambien se explica.
  it('explains why an item with stock cannot be deactivated', () => {
    expect(readableInventoryError(AccessError.fromStatus(409, { code: 'ItemWithStockError' }), FALLBACK)).toContain('existencia');
  });

  it('falls back to the catalog and access translations', () => {
    expect(readableInventoryError(AccessError.fromStatus(403, { code: 'PermissionDeniedError' }), FALLBACK)).toBe(
      'Tu rol no te permite hacer esto.',
    );
  });

  it('uses the fallback for something that is not an API error', () => {
    expect(readableInventoryError(new Error('boom'), FALLBACK)).toBe(FALLBACK);
  });
});
