import { BoundedText } from '../shared/bounded-text.vo.js';

export class WarehouseName extends BoundedText {
  static of(value: string): WarehouseName {
    return new WarehouseName(value, 150);
  }
}
