import { InvalidBarcodeError } from '../errors/item.errors.js';
import { BoundedText } from '../shared/bounded-text.vo.js';

const BARCODE_PATTERN = /^[A-Z0-9._-]+$/;

// El codigo que trae impreso el producto. Se guarda en mayusculas y sin espacios, como el SKU: el
// lector siempre manda lo mismo, y la unicidad por empresa tiene que verlo igual.
export class Barcode extends BoundedText {
  private constructor(value: string) {
    super(value.trim().toUpperCase(), 60);

    if (!BARCODE_PATTERN.test(this.value)) {
      throw new InvalidBarcodeError(this.value);
    }
  }

  static of(value: string): Barcode {
    return new Barcode(value);
  }
}
