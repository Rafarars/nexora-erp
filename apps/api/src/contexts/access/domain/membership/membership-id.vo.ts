import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class MembershipId extends Uuid {
  static of(value: string): MembershipId {
    return new MembershipId(value);
  }
}
