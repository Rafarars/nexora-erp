import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class PriceListId extends Uuid {
  static of(value: string): PriceListId {
    return new PriceListId(value);
  }
}
