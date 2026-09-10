import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';
import { StringValueObject } from '../../../../shared/domain/value-object.js';

// Deliberadamente permisivo: valida la forma, no la existencia del buzon. Lo unico
// que prueba que un correo existe es enviarle algo.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export class InvalidEmailError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Email must be a valid address, received <${value}>.`);
  }
}

export class Email extends StringValueObject {
  private constructor(value: string) {
    super(value);

    if (!EMAIL_PATTERN.test(value)) {
      throw new InvalidEmailError(value);
    }
  }

  // Normaliza al construir: el correo es unico global y "Ana@X.com" no puede
  // convivir con "ana@x.com".
  static of(value: string): Email {
    return new Email(value.trim().toLowerCase());
  }
}
