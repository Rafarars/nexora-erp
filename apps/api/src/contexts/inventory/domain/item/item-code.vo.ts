import { StringValueObject } from '../../../../shared/domain/value-object.js';
import { InvalidItemCodeError } from '../errors/item.errors.js';
import { InventoryCodePrefix, documentCode } from '../shared/code-sequence.js';

const CODE_PATTERN = /^ART\d{6,}$/;

// El correlativo legible que ve una persona (`ART000001`), distinto del UUID. Lo genera el
// sistema; nadie lo escribe.
export class ItemCode extends StringValueObject {
  static readonly PREFIX: InventoryCodePrefix = 'ART';

  private constructor(value: string) {
    super(value);

    if (!CODE_PATTERN.test(value)) {
      throw new InvalidItemCodeError(value);
    }
  }

  static of(value: string): ItemCode {
    return new ItemCode(value);
  }

  static fromSequence(sequence: number): ItemCode {
    return new ItemCode(documentCode(ItemCode.PREFIX, sequence));
  }
}
