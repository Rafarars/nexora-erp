import { BoundedText } from '../shared/bounded-text.vo.js';

export class MeasurementUnitName extends BoundedText {
  static of(value: string): MeasurementUnitName {
    return new MeasurementUnitName(value, 100);
  }
}
