import { ConflictError } from '../../../../shared/domain/domain.error.js';

// Desactivar algo que usa un articulo activo lo dejaria apuntando a un registro que ya
// no se ofrece en ningun selector.
export class CategoryInUseError extends ConflictError {
  constructor(id: string) {
    super(
      `Category <${id}> is used by active items.`,
      'The category is used by active items and cannot be deactivated.',
    );
  }
}

export class MeasurementUnitInUseError extends ConflictError {
  constructor(id: string) {
    super(
      `Measurement unit <${id}> is used by active items.`,
      'The measurement unit is used by active items and cannot be deactivated.',
    );
  }
}

export class TaxInUseError extends ConflictError {
  constructor(id: string) {
    super(`Tax <${id}> is used by active items.`, 'The tax is used by active items and cannot be deactivated.');
  }
}

// Una bodega con existencia desapareceria de los selectores con mercancia dentro, y nadie
// podria sacarla con un ajuste.
export class WarehouseWithStockError extends ConflictError {
  constructor(id: string) {
    super(`Warehouse <${id}> still has stock.`, 'The warehouse still has stock and cannot be deactivated.');
  }
}
