import { Uuid } from '../../../../shared/domain/uuid.vo.js';

export class MeasurementUnitId extends Uuid {
  static of(value: string): MeasurementUnitId {
    return new MeasurementUnitId(value);
  }
}
