import { InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';

export class ReportCustomerNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Customer <${id}> does not exist.`);
  }
}

export class ReportWarehouseNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Warehouse <${id}> does not exist.`);
  }
}

export class InvalidReportDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Date <${value}> is not a valid calendar day.`, 'The date is not valid.');
  }
}

export class InvalidReportPeriodError extends InvalidArgumentError {
  constructor(from: string, to: string) {
    super(`Period from <${from}> to <${to}> ends before it starts.`, 'The period ends before it starts.');
  }
}

export class ReportPeriodTooLongError extends InvalidArgumentError {
  constructor(from: string, to: string, max: number) {
    super(`Period from <${from}> to <${to}> is longer than <${max}> days.`, 'The period cannot be longer than one year.');
  }
}

export class InvalidExportFormatError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Export format <${value}> is not supported.`, 'The export format is not supported.');
  }
}
