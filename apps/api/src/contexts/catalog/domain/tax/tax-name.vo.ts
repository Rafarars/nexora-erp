import { BoundedText } from '../shared/bounded-text.vo.js';

export class TaxName extends BoundedText {
  static of(value: string): TaxName {
    return new TaxName(value, 100);
  }
}
