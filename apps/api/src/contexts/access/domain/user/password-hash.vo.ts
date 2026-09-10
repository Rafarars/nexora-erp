import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';
import { StringValueObject } from '../../../../shared/domain/value-object.js';

export class PlainPasswordError extends InvalidArgumentError {
  constructor() {
    super('PasswordHash must be a hashed value, never a plain password.');
  }
}

export class PasswordHash extends StringValueObject {
  private constructor(value: string) {
    super(value);

    // No valida "es argon2": valida "no es texto plano", que es el error real que
    // se quiere evitar. Cambiar de algoritmo no deberia tocar el dominio.
    if (!value.startsWith('$') || value.length < 16) {
      throw new PlainPasswordError();
    }
  }

  static of(value: string): PasswordHash {
    return new PasswordHash(value);
  }
}
