import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class ItemId extends Uuid {
  static of(value: string): ItemId {
    return new ItemId(value);
  }
}
