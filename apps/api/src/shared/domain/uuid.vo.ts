import { InvalidArgumentError } from './domain.error.js';
import { StringValueObject } from './value-object.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidUuidError extends InvalidArgumentError {
  constructor(name: string, value: string) {
    super(`${name} must be a valid UUID, received <${value}>.`, 'An identifier is not valid.');
  }
}

export abstract class Uuid extends StringValueObject {
  protected constructor(value: string) {
    // En minusculas siempre. El patron acepta mayusculas y PostgreSQL trata los dos iguales, pero
    // los dobles en memoria comparan cadenas: sin normalizar aqui, el mismo identificador escrito
    // en mayusculas se encontraba en la base y no en el doble, y el contrato pasaba en verde.
    super(value.toLowerCase());

    if (!UUID_PATTERN.test(this.value)) {
      throw new InvalidUuidError(new.target.name, value);
    }
  }
}
