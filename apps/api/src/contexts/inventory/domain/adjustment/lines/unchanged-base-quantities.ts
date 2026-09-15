import { StockItemChangedError } from '../../errors/inventory.errors.js';
import { AdjustmentLine } from '../adjustment-line.js';

// Un borrador guardo sus cantidades base con la caja que el articulo tenia al escribirlo. Si al
// confirmarlo la caja ya es otra, no se recalcula en silencio: «1 caja» contada cuando traia 24 no
// puede entrar como 12 sin que nadie lo vea. La persona revisa el borrador y lo vuelve a guardar.
export function ensureBaseQuantitiesUnchanged(written: AdjustmentLine[], today: AdjustmentLine[]): void {
  written.forEach((line, index) => {
    if (!line.baseQuantity.equals(today[index].baseQuantity)) throw new StockItemChangedError(line.itemId.value);
  });
}
