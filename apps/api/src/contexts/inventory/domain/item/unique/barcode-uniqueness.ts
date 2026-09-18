import { DuplicateBarcodeError } from '../../errors/item.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { Barcode } from '../barcode.vo.js';
import { ItemId } from '../item-id.vo.js';
import { ItemRepository } from '../item.repository.js';

// Dos articulos con el mismo codigo de barras harian que el lector no sepa cual es cual.
export class BarcodeUniqueness {
  constructor(private readonly items: ItemRepository) {}

  async ensureIsFree(tenantId: TenantId, barcode: Barcode | null, except?: ItemId): Promise<void> {
    if (!barcode) return;

    const existing = await this.items.findByBarcode(tenantId, barcode);

    if (existing && !(except && existing.id.equals(except))) {
      throw new DuplicateBarcodeError(barcode.value, tenantId.value);
    }
  }
}
