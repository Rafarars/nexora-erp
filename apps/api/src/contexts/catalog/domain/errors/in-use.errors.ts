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

// Un articulo o una bodega con existencia desaparecerian de los selectores con mercancia
// dentro, y nadie podria sacarla con un ajuste.
export class ItemWithStockError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> still has stock.`, 'The item still has stock and cannot be deactivated.');
  }
}

export class WarehouseWithStockError extends ConflictError {
  constructor(id: string) {
    super(`Warehouse <${id}> still has stock.`, 'The warehouse still has stock and cannot be deactivated.');
  }
}

// El kardex guarda cantidades en la unidad base del articulo: cambiarla, o convertir un
// articulo con historia en servicio, haria que su historia dijera otra cosa.
export class ItemWithMovementsError extends ConflictError {
  constructor(id: string) {
    super(
      `Item <${id}> has inventory movements; its base unit and type are fixed.`,
      'The item already has inventory movements: its base unit and its type cannot change.',
    );
  }
}

// Una orden de compra o un pedido confirmados ya prometieron cantidades de este articulo:
// desactivarlo o volverlo servicio dejaria ese documento sin poder recibirse ni despacharse.
export class ItemInOpenDocumentsError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> is used by open purchase or sales orders.`, 'The item is used by open purchase or sales orders.');
  }
}

// El documento abierto guardo su cantidad base con el factor de esa unidad: cambiarlo o quitar
// la unidad lo descuadraria con lo que prometio.
export class ItemUnitInOpenDocumentsError extends ConflictError {
  constructor(itemId: string, unitId: string) {
    super(
      `Unit <${unitId}> of item <${itemId}> is used by open purchase or sales orders.`,
      'A unit used by open purchase or sales orders cannot be removed or change its factor.',
    );
  }
}
