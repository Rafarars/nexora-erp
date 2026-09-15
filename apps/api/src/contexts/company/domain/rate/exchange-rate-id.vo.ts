import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class ExchangeRateId extends Uuid {
  static of(value: string): ExchangeRateId {
    return new ExchangeRateId(value);
  }
}
