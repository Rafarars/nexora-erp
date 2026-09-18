import { Clock } from '../../../../shared/domain/ports/clock.js';
import { ensureCanChange } from '../../domain/item/commitments/item-commitments.js';
import { ItemFinder } from '../../domain/item/find/item-finder.js';
import { ItemDetailsInput, itemDetailsOf } from '../../domain/item/item-details.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { ItemPosting } from '../../domain/item/posting/item-posting.js';
import { ItemReferences } from '../../domain/item/references/item-references.js';
import { BarcodeUniqueness } from '../../domain/item/unique/barcode-uniqueness.js';
import { SkuUniqueness } from '../../domain/item/unique/sku-uniqueness.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ItemUpdaterRequest extends ItemDetailsInput {
  tenantId: string;
  itemId: string;
}

export class ItemUpdater {
  constructor(
    private readonly finder: ItemFinder,
    private readonly references: ItemReferences,
    private readonly skus: SkuUniqueness,
    private readonly barcodes: BarcodeUniqueness,
    private readonly posting: ItemPosting,
    private readonly clock: Clock,
  ) {}

  async run(request: ItemUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const item = await this.finder.find(tenantId, ItemId.of(request.itemId));
    const details = itemDetailsOf(request);

    await this.references.ensureAssignable(tenantId, details, item);
    await this.skus.ensureIsFree(tenantId, details.sku, item.id);
    await this.barcodes.ensureIsFree(tenantId, details.barcode, item.id);

    const now = this.clock.now();

    // Lo que el articulo comprometio se decide con su fila bloqueada: un documento que se
    // confirma a la vez espera a este cambio, o este cambio lo espera a el.
    await this.posting.post(tenantId, item.id, (locked, commitments) => {
      ensureCanChange(locked, details, commitments);
      locked.update(details, now);
    });
  }
}
