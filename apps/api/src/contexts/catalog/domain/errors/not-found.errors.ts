import { NotFoundError } from '../../../../shared/domain/domain.error.js';

// Un registro de otra empresa llega como inexistente: el repositorio filtra por empresa
// y responder 403 confirmaria que existe.
export class CategoryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Category <${id}> does not exist.`);
  }
}

export class MeasurementUnitNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Measurement unit <${id}> does not exist.`);
  }
}

export class TaxNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Tax <${id}> does not exist.`);
  }
}

export class WarehouseNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Warehouse <${id}> does not exist.`);
  }
}
