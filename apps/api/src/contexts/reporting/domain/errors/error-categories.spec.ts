import { describe, expect, it } from 'vitest';
import { DomainError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';
import * as errors from './reporting.errors.js';

const ID = 'a1111111-1111-4111-8111-111111111111';

const cases: Array<[DomainError, typeof DomainError]> = [
  [new errors.ReportCustomerNotFoundError(ID), NotFoundError],
  [new errors.ReportWarehouseNotFoundError(ID), NotFoundError],
  [new errors.InvalidReportDateError('x'), InvalidArgumentError],
  [new errors.InvalidReportPeriodError('2026-02-01', '2026-01-01'), InvalidArgumentError],
  [new errors.ReportPeriodTooLongError('2026-01-01', '2027-06-01', 366), InvalidArgumentError],
  [new errors.InvalidExportFormatError('doc'), InvalidArgumentError],
  [new errors.InvalidPageError(), InvalidArgumentError],
];

describe('reporting domain errors', () => {
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
