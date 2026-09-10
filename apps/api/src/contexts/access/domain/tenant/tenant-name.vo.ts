import { StringValueObject } from '../../../../shared/domain/value-object.js';

export class TenantName extends StringValueObject {
  static of(value: string): TenantName {
    return new TenantName(value.trim());
  }
}
