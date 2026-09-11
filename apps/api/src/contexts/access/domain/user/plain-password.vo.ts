import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';
import { StringValueObject } from '../../../../shared/domain/value-object.js';

const MINIMUM_LENGTH = 8;

export class WeakPasswordError extends InvalidArgumentError {
  constructor() {
    super(`A password must be at least ${MINIMUM_LENGTH} characters long.`);
  }
}

// La contrasena en claro, solo de paso: se valida y se entrega al hasher. Nunca se
// guarda ni se serializa, por eso no tiene toPrimitives.
export class PlainPassword extends StringValueObject {
  private constructor(value: string) {
    super(value);

    if (value.length < MINIMUM_LENGTH) {
      throw new WeakPasswordError();
    }
  }

  static of(value: string): PlainPassword {
    return new PlainPassword(value);
  }
}
