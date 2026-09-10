import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class RoleId extends Uuid {
  static of(value: string): RoleId {
    return new RoleId(value);
  }
}
