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

  // La pantalla de articulos traduce con este modulo: sin estos codigos, un 409 de existencia se
  // leia como «Ese dato ya existe».
  it.each([
    ['ItemWithStockError', 'existencia'],
    ['ItemWithMovementsError', 'movimientos'],
    ['ItemInOpenDocumentsError', 'abiertos'],
    ['ItemStopsBeingTradedError', 'antes de dejar de comprarlo'],
    ['ItemUnitInOpenDocumentsError', 'factor'],
    ['DuplicateSkuError', 'SKU'],
  ])('explains %s as a rule of the item', (code, words) => {
    expect(readableInventoryError(AccessError.fromStatus(409, { code }), FALLBACK)).toContain(words);
  });

  it('points at the units row of an item instead of a JSON path', () => {
    const error = AccessError.fromStatus(400, { code: 'ValidationError', fields: ['units.1.conversionFactor'] });

    expect(readableInventoryError(error, FALLBACK)).toContain('Revisa las unidades');
  });

  it('asks for the SKU when it is missing', () => {
    expect(readableInventoryError(AccessError.fromStatus(400, { code: 'ValidationError', fields: ['sku'] }), FALLBACK)).toBe('Escribe un SKU.');
  });

  // La caja del articulo cambio desde que se escribio: se revisa y se guarda, no se recalcula solo.
  it('asks to review and save a draft whose item changed', () => {
    expect(readableInventoryError(AccessError.fromStatus(409, { code: 'StockItemChangedError' }), FALLBACK)).toContain('revisa las cantidades');
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
