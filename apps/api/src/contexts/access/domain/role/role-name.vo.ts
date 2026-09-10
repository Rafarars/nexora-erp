import { StringValueObject } from '../../../../shared/domain/value-object.js';

export class RoleName extends StringValueObject {
  static of(value: string): RoleName {
    return new RoleName(value.trim());
  }
}
