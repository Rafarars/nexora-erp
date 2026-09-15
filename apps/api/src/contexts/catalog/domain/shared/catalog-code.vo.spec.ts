import { describe, expect, it } from 'vitest';
import { CatalogCode, InvalidCatalogCodeError } from './catalog-code.vo.js';

describe('CatalogCode', () => {
  it('pads the sequence to six digits after the prefix', () => {
    expect(CatalogCode.fromSequence('CAT', 7).value).toBe('CAT000007');
  });

  // Pasado el millon no se rompe la numeracion: el patron admite mas digitos.
  it('keeps counting beyond six digits', () => {
    expect(CatalogCode.fromSequence('CAT', 1_234_567).value).toBe('CAT1234567');
  });

  it.each(['art000001', 'AR000001', 'ART00001', 'ART-000001', ''])('rejects %j', (value) => {
    expect(() => CatalogCode.of(value)).toThrow();
  });

  it('names the error so it maps to a 400', () => {
    expect(() => CatalogCode.of('nope')).toThrow(InvalidCatalogCodeError);
  });
});
