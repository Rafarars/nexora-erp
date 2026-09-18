import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { ItemCode } from '../../domain/item/item-code.vo.js';
import { ItemDetailsInput, itemDetailsOf } from '../../domain/item/item-details.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { Item } from '../../domain/item/item.entity.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { ItemReferences } from '../../domain/item/references/item-references.js';
import { BarcodeUniqueness } from '../../domain/item/unique/barcode-uniqueness.js';
import { SkuUniqueness } from '../../domain/item/unique/sku-uniqueness.js';
import { InventoryCodeSequence } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ItemCreatorRequest extends ItemDetailsInput {
  tenantId: string;
}

export class ItemCreator {
  constructor(
    private readonly items: ItemRepository,
    private readonly references: ItemReferences,
    private readonly skus: SkuUniqueness,
    private readonly barcodes: BarcodeUniqueness,
    private readonly codes: InventoryCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: ItemCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    // Primero lo que no necesita la base: un valor invalido responde 400 sin consultar.
    const details = itemDetailsOf(request);

    await this.references.ensureAssignable(tenantId, details);
    await this.skus.ensureIsFree(tenantId, details.sku);
    await this.barcodes.ensureIsFree(tenantId, details.barcode);

    const code = ItemCode.fromSequence(await this.codes.next(tenantId, ItemCode.PREFIX));

    await this.items.save(Item.create(ItemId.of(this.ids.next()), tenantId, code, details, this.clock.now()));
  }
}
