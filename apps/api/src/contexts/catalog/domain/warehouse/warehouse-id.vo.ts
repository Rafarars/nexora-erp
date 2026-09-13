import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class WarehouseId extends Uuid {
  static of(value: string): WarehouseId {
    return new WarehouseId(value);
  }
}
