import { ConflictError } from '../../../../shared/domain/domain.error.js';

// Dos registros homonimos en una empresa harian imposible saber cual se elige en un
// selector.
export class DuplicateCategoryNameError extends ConflictError {
  constructor(name: string, tenantId: string) {
    super(
      `Category <${name}> already exists in tenant <${tenantId}>.`,
      'A category with that name already exists.',
    );
  }
}

export class DuplicateMeasurementUnitNameError extends ConflictError {
  constructor(name: string, tenantId: string) {
    super(
      `Measurement unit <${name}> already exists in tenant <${tenantId}>.`,
      'A measurement unit with that name already exists.',
    );
  }
}

export class DuplicateMeasurementUnitAbbreviationError extends ConflictError {
  constructor(abbreviation: string, tenantId: string) {
    super(
      `Abbreviation <${abbreviation}> already exists in tenant <${tenantId}>.`,
      'A measurement unit with that abbreviation already exists.',
    );
  }
}

export class DuplicateTaxNameError extends ConflictError {
  constructor(name: string, tenantId: string) {
    super(`Tax <${name}> already exists in tenant <${tenantId}>.`, 'A tax with that name already exists.');
  }
}

export class DuplicateWarehouseNameError extends ConflictError {
  constructor(name: string, tenantId: string) {
    super(
      `Warehouse <${name}> already exists in tenant <${tenantId}>.`,
      'A warehouse with that name already exists.',
    );
  }
}

export class DuplicateSkuError extends ConflictError {
  constructor(sku: string, tenantId: string) {
    super(`SKU <${sku}> already exists in tenant <${tenantId}>.`, 'An item with that SKU already exists.');
  }
}
