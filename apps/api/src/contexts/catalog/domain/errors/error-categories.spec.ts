import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  DomainError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../../shared/domain/domain.error.js';
import { InvalidAbbreviationError } from '../measurement-unit/unit-abbreviation.vo.js';
import { InvalidCatalogCodeError } from '../shared/catalog-code.vo.js';
import { TextTooLongError } from '../shared/bounded-text.vo.js';
import {
  DuplicateCategoryNameError,
  DuplicateMeasurementUnitAbbreviationError,
  DuplicateMeasurementUnitNameError,
  DuplicateSkuError,
  DuplicateTaxNameError,
  DuplicateWarehouseNameError,
} from './duplicate.errors.js';
import { InactiveReferenceError } from './inactive-reference.error.js';
import { CategoryInUseError, MeasurementUnitInUseError, TaxInUseError } from './in-use.errors.js';
import {
  InvalidConversionFactorError,
  InvalidItemTypeError,
  InvalidItemUnitsError,
  InvalidSkuError,
  InvalidTaxRateError,
} from './invalid-values.errors.js';
import {
  CategoryNotFoundError,
  ItemNotFoundError,
  MeasurementUnitNotFoundError,
  TaxNotFoundError,
  WarehouseNotFoundError,
} from './not-found.errors.js';
import {
  ConcurrentDefaultWarehouseError,
  DefaultWarehouseDeactivationError,
  InactiveDefaultWarehouseError,
} from './warehouse.errors.js';

const ID = 'c1111111-1111-4111-8111-111111111111';
const TENANT = '11111111-1111-4111-8111-111111111111';

// El filtro global traduce por categoria: un error que no herede de la suya saldria
// como 500. Y el mensaje publico nunca lleva lo que el interno si puede llevar.
const cases: Array<[DomainError, typeof DomainError]> = [
  [new CategoryNotFoundError(ID), NotFoundError],
  [new MeasurementUnitNotFoundError(ID), NotFoundError],
  [new TaxNotFoundError(ID), NotFoundError],
  [new WarehouseNotFoundError(ID), NotFoundError],
  [new ItemNotFoundError(ID), NotFoundError],
  [new DuplicateCategoryNameError('Bebidas', TENANT), ConflictError],
  [new DuplicateMeasurementUnitNameError('Caja', TENANT), ConflictError],
  [new DuplicateMeasurementUnitAbbreviationError('cja', TENANT), ConflictError],
  [new DuplicateTaxNameError('IVA', TENANT), ConflictError],
  [new DuplicateWarehouseNameError('Principal', TENANT), ConflictError],
  [new DuplicateSkuError('AGUA-500', TENANT), ConflictError],
  [new CategoryInUseError(ID), ConflictError],
  [new MeasurementUnitInUseError(ID), ConflictError],
  [new TaxInUseError(ID), ConflictError],
  [new DefaultWarehouseDeactivationError(ID), ConflictError],
  [new InactiveDefaultWarehouseError(ID), ConflictError],
  [new ConcurrentDefaultWarehouseError(TENANT), ConflictError],
  [new InactiveReferenceError('Category', ID), ConflictError],
  [new InvalidTaxRateError(120), InvalidArgumentError],
  [new InvalidConversionFactorError(-1), InvalidArgumentError],
  [new InvalidSkuError('A B'), InvalidArgumentError],
  [new InvalidItemTypeError('serialized'), InvalidArgumentError],
  [new InvalidItemUnitsError('no base'), InvalidArgumentError],
  [new InvalidAbbreviationError('c ja'), InvalidArgumentError],
  [new InvalidCatalogCodeError('nope'), InvalidArgumentError],
  [new TextTooLongError('CategoryName', 150), InvalidArgumentError],
];

describe('catalog domain errors', () => {
  it.each(cases)('%s belongs to its category', (error, category) => {
    expect(error).toBeInstanceOf(category);
  });

  it.each(cases)('%s gives the caller a message with nothing internal', (error) => {
    expect(error.publicMessage.length).toBeGreaterThan(0);
    expect(error.publicMessage).not.toMatch(/[<>]/);
    expect(error.publicMessage).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(error.publicMessage).not.toContain('Bebidas');
    expect(error.publicMessage).not.toContain('AGUA-500');
  });

  it('names itself with its concrete class, which is the code the interface translates', () => {
    expect(new DuplicateSkuError('AGUA-500', TENANT).name).toBe('DuplicateSkuError');
  });
});
