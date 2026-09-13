import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class TaxId extends Uuid {
  static of(value: string): TaxId {
    return new TaxId(value);
  }
}
