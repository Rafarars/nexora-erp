import { BoundedText } from '../shared/bounded-text.vo.js';

export class ItemName extends BoundedText {
  static of(value: string): ItemName {
    return new ItemName(value, 200);
  }
}
