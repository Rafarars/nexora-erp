import { InvalidSkuError } from '../errors/item.errors.js';
import { BoundedText } from '../shared/bounded-text.vo.js';

const SKU_PATTERN = /^[A-Z0-9._-]+$/;

// Se guarda en mayusculas: `agua-500` y `AGUA-500` son el mismo articulo para quien lo
// busca, y la unicidad tiene que verlo asi.
export class Sku extends BoundedText {
  private constructor(value: string) {
    super(value.trim().toUpperCase(), 60);

    if (!SKU_PATTERN.test(this.value)) {
      throw new InvalidSkuError(this.value);
    }
  }

  static of(value: string): Sku {
    return new Sku(value);
  }
}
