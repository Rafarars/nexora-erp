import { BoundedText } from '../shared/bounded-text.vo.js';

export class CategoryName extends BoundedText {
  static of(value: string): CategoryName {
    return new CategoryName(value, 150);
  }
}
