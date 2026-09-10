import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class UserId extends Uuid {
  static of(value: string): UserId {
    return new UserId(value);
  }
}
