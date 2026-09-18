import { BoundedText } from '../shared/bounded-text.vo.js';

export class PriceListName extends BoundedText {
  static of(value: string): PriceListName {
    return new PriceListName(value, 150);
  }
}
