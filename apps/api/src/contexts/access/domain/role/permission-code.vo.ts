import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';
import { StringValueObject } from '../../../../shared/domain/value-object.js';

const CODE_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)+$/;

export class InvalidPermissionCodeError extends InvalidArgumentError {
  constructor(value: string) {
    super(`PermissionCode must be dot separated lowercase segments, received <${value}>.`);
  }
}

// El codigo ES la identidad del permiso: `sales.invoices.create`. Sin identificador
// artificial, asi declarar uno nuevo es insertar una fila.
export class PermissionCode extends StringValueObject {
  private constructor(value: string) {
    super(value);

    if (!CODE_PATTERN.test(value)) {
      throw new InvalidPermissionCodeError(value);
    }
  }

  static of(value: string): PermissionCode {
    return new PermissionCode(value.trim().toLowerCase());
  }
}
