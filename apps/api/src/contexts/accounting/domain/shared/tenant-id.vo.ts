import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class TenantId extends Uuid {
  static of(value: string): TenantId {
    return new TenantId(value);
  }
}
