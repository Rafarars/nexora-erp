import { StringValueObject } from '../../../../shared/domain/value-object.js';

export class UserName extends StringValueObject {
  static of(value: string): UserName {
    return new UserName(value.trim());
  }
}
