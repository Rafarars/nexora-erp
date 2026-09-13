import { InvalidArgumentError } from './domain.error.js';

class EmptyStringValueError extends InvalidArgumentError {
  constructor(name: string) {
    super(`${name} cannot be empty.`, 'A required value is empty.');
  }
}

export abstract class StringValueObject {
  protected constructor(readonly value: string) {
    if (value.trim().length === 0) {
      throw new EmptyStringValueError(new.target.name);
    }
  }

  equals(other: StringValueObject): boolean {
    return this.constructor === other.constructor && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
