import { describe, expect, it } from 'vitest';
import { ConflictError, DomainError, InvalidArgumentError } from '../domain.error.js';
import { FixedExchangeRateError, MissingExchangeRateError, RateOverrideNotAllowedError } from './document-rates.js';

const cases: Array<[DomainError, typeof DomainError]> = [
  [new MissingExchangeRateError('USD', 'legal', '2026-01-15'), ConflictError],
  [new RateOverrideNotAllowedError('11111111-1111-4111-8111-111111111111'), ConflictError],
  [new FixedExchangeRateError('USD'), InvalidArgumentError],
];

describe('document rates errors', () => {
  it.each(cases)('%s belongs to its category', (error, category) => {
    expect(error).toBeInstanceOf(category);
  });

  it.each(cases)('%s gives the caller a message with nothing internal', (error) => {
    expect(error.publicMessage.length).toBeGreaterThan(0);
    expect(error.publicMessage).not.toMatch(/[<>]|\d/);
  });
});
