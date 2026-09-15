import { describe, expect, it } from 'vitest';
import { ConflictError, DomainError, InvalidArgumentError } from '../../../../shared/domain/domain.error.js';
import * as errors from './company.errors.js';

const ID = '11111111-1111-4111-8111-111111111111';

const cases: Array<[DomainError, typeof DomainError]> = [
  [new errors.InvalidCurrencyCodeError('US$'), InvalidArgumentError],
  [new errors.UnknownCurrencyError('XYZ'), InvalidArgumentError],
  [new errors.InactiveCurrencyError('VEF'), ConflictError],
  [new errors.InvalidTimeZoneError('Marte/Olympus'), InvalidArgumentError],
  [new errors.InvalidDecimalPlacesError('AmountDecimals', 9, 4), InvalidArgumentError],
  [new errors.BaseCurrencyLockedError(ID), ConflictError],
  [new errors.RequiredCompanyTextError('CompanyLegalName'), InvalidArgumentError],
  [new errors.CompanyTextTooLongError('CompanyAddress', 300), InvalidArgumentError],
  [new errors.InvalidCompanyEmailError('x'), InvalidArgumentError],
];

describe('company domain errors', () => {
  it('covers every error the context declares', () => {
    expect(cases).toHaveLength(Object.keys(errors).length);
  });

  it.each(cases)('%s belongs to its category', (error, category) => {
    expect(error).toBeInstanceOf(category);
  });

  it.each(cases)('%s gives the caller a message with nothing internal', (error) => {
    expect(error.publicMessage.length).toBeGreaterThan(0);
    expect(error.publicMessage).not.toMatch(/[<>]|\d/);
  });
});
