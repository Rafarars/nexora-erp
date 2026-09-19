import { ConflictError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';

// Los errores del maestro de articulos. Conservan el nombre que tenian en el catalogo: la
// interfaz los traduce por nombre.

// Un registro de otra empresa llega como inexistente: responder 403 confirmaria que existe.
export class ItemNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Item <${id}> does not exist.`);
  }
}

export class CategoryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Category <${id}> does not exist.`);
  }
}

export class TaxNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Tax <${id}> does not exist.`);
  }
}

export class MeasurementUnitNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Measurement unit <${id}> does not exist.`);
  }
}

export class DuplicateSkuError extends ConflictError {
  constructor(sku: string, tenantId: string) {
    super(`SKU <${sku}> already exists in tenant <${tenantId}>.`, 'An item with that SKU already exists.');
  }
}

// Dejar de comprar o de vender un articulo es, para un documento vivo, lo mismo que darlo de baja.
export class ItemStopsBeingTradedError extends ConflictError {
  constructor(itemId: string, side: 'purchase' | 'sales') {
    super(
      `Item <${itemId}> still has open ${side} documents.`,
      'The item cannot stop being traded while it has open documents.',
    );
  }
}

export class DuplicateBarcodeError extends ConflictError {
  constructor(barcode: string, tenantId: string) {
    super(`Barcode <${barcode}> already exists in tenant <${tenantId}>.`, 'An item with that barcode already exists.');
  }
}

// Un articulo nuevo no puede nacer apuntando a algo que ya no se ofrece.
export class InactiveReferenceError extends ConflictError {
  constructor(kind: string, id: string) {
    super(`${kind} <${id}> is inactive and cannot be assigned.`, 'The item refers to a record that is inactive.');
  }
}

// Con existencia, el articulo desapareceria de los selectores con mercancia dentro, y nadie
// podria sacarla con un ajuste.
export class ItemWithStockError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> still has stock.`, 'The item still has stock and cannot be deactivated.');
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

export class InvalidConversionFactorError extends InvalidArgumentError {
  constructor(value: number) {
    super(
      `A conversion factor must be positive with at most eight decimals, received <${value}>.`,
      'A conversion factor must be a positive number.',
    );
  }
}

// Las reglas de reposicion de un articulo: una por bodega, con cantidades sin signo.
export class InvalidReorderRuleError extends InvalidArgumentError {
  constructor(reason: string) {
    super(`Invalid reorder rule: ${reason}`, 'The minimum, maximum and reorder quantities are not valid.');
  }
}

export class InvalidBarcodeError extends InvalidArgumentError {
  constructor(value: string) {
    super(
      `A barcode may only contain letters, digits, dots, dashes and underscores, received <${value}>.`,
      'The barcode contains characters that are not allowed.',
    );
  }
}

export class InvalidSkuError extends InvalidArgumentError {
  constructor(value: string) {
    super(
      `A SKU may only contain letters, digits, dots, dashes and underscores, received <${value}>.`,
      'The SKU contains characters that are not allowed.',
    );
  }
}

export class InvalidItemTypeError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Unknown item type <${value}>.`, 'The item type is not valid.');
  }
}

// Las reglas de las unidades de un articulo tienen cada una su motivo, y el mensaje
// interno lo dice; hacia fuera basta con senalar que las unidades no cuadran.
export class InvalidItemUnitsError extends InvalidArgumentError {
  constructor(reason: string) {
    super(`Invalid item units: ${reason}`, 'The units of the item are not valid.');
  }
}

export class InvalidItemCodeError extends InvalidArgumentError {
  constructor(value: string) {
    super(`An item code must be ART followed by six digits, received <${value}>.`, 'The item code is not valid.');
  }
}

export class InvalidItemPriceError extends InvalidArgumentError {
  constructor(reason: string) {
    super(`Invalid item price: ${reason}`, 'The price is not valid.');
  }
}

// El minimo es el piso de venta del articulo y esta en la moneda de la empresa: un precio de lista
// por debajo dejaria pasar lo que la linea del pedido si rechaza.
export class PriceBelowMinimumError extends InvalidArgumentError {
  constructor(price: number, minimum: number) {
    super(
      `Price <${price}> is below the minimum <${minimum}> of the item.`,
      'The price is below the minimum allowed for that item.',
    );
  }
}

export class PriceListNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Price list <${id}> does not exist.`);
  }
}
