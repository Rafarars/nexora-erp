import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class SupplierId extends Uuid {
  static of(value: string): SupplierId {
    return new SupplierId(value);
  }
}
