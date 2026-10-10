import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class AccountId extends Uuid {
  static of(value: string): AccountId {
    return new AccountId(value);
  }
}
