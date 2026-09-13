import { describe, expect, it } from 'vitest';
import { hasAtMostFourDecimals } from './decimal.js';

describe('hasAtMostFourDecimals', () => {
  it.each([0, 1, 16, 12.5, 0.0001, 99.9999, 1234.5678])('accepts %d', (value) => {
    expect(hasAtMostFourDecimals(value)).toBe(true);
  });

  // 0.1 + 0.2 no es exacto en coma flotante: la tolerancia evita rechazar un valor que
  // la persona escribio bien.
  it('tolerates floating point noise', () => {
    expect(hasAtMostFourDecimals(0.1 + 0.2)).toBe(true);
  });

  it.each([0.00001, 16.12345, 1 / 3])('rejects %d', (value) => {
    expect(hasAtMostFourDecimals(value)).toBe(false);
  });
});
