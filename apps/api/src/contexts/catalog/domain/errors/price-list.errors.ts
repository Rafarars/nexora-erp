import { ConflictError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';

export class InvalidPriceListCurrencyError extends InvalidArgumentError {
  constructor(value: string) {
    super(`A currency code must be three letters, received <${value}>.`);
  }
}

export class PriceListNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Price list <${id}> does not exist.`);
  }
}

export class DuplicatePriceListNameError extends ConflictError {
  constructor(name: string, tenantId: string) {
    super(
      `Price list <${name}> already exists in tenant <${tenantId}>.`,
      'A price list with that name already exists.',
    );
  }
}

// Sin lista por defecto, un cliente sin lista propia se quedaria sin precio sugerido.
export class DefaultPriceListDeactivationError extends ConflictError {
  constructor(id: string) {
    super(
      `Price list <${id}> is the default one and cannot be deactivated.`,
      'The default price list cannot be deactivated. Choose another default first.',
    );
  }
}

export class InactiveDefaultPriceListError extends ConflictError {
  constructor(id: string) {
    super(
      `Price list <${id}> is inactive and cannot be the default one.`,
      'An inactive price list cannot be the default one.',
    );
  }
}

// La moneda de una lista se usa para convertir sus precios: si no existe o esta apagada, no hay
// tasa con la que hacerlo.
export class UnknownPriceListCurrencyError extends InvalidArgumentError {
  constructor(currency: string) {
    super(`Currency <${currency}> is not available.`, 'That currency is not available.');
  }
}

// Dos personas eligiendo a la vez la lista por defecto: la base deja pasar solo a una.
export class ConcurrentDefaultPriceListError extends ConflictError {
  constructor(tenantId: string) {
    super(
      `Another price list became the default one of tenant <${tenantId}> at the same time.`,
      'Another price list became the default one at the same time. Try again.',
    );
  }
}
