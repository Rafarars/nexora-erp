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
    super(value);

    if (!UUID_PATTERN.test(value)) {
      throw new InvalidUuidError(new.target.name, value);
    }
  }
}
