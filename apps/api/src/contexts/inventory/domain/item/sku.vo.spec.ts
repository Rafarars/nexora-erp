import { describe, expect, it } from 'vitest';
import { InvalidSkuError } from '../errors/item.errors.js';
import { Sku } from './sku.vo.js';

describe('Sku', () => {
  // `agua-500` y `AGUA-500` son el mismo articulo para quien lo busca.
  it('is stored uppercase and trimmed', () => {
    expect(Sku.of('  agua-500 ').value).toBe('AGUA-500');
  });

  it.each(['AGUA-500', 'A.B_C-1', '12345'])('accepts %s', (value) => {
    expect(Sku.of(value).value).toBe(value);
  });

  it.each(['AGUA 500', 'AGUA/500', 'ÑANDÚ', 'AGUA#1'])('rejects %s', (value) => {
    expect(() => Sku.of(value)).toThrow(InvalidSkuError);
  });

  it('rejects more than sixty characters', () => {
    expect(() => Sku.of('A'.repeat(61))).toThrow(/longer than 60/);
  });
});
