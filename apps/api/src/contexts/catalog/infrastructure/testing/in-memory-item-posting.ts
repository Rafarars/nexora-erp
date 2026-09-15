import { ItemNotFoundError } from '../../domain/errors/not-found.errors.js';
import { ItemCommitments } from '../../domain/item/commitments/item-commitments.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { Item } from '../../domain/item/item.entity.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { ItemPosting } from '../../domain/item/posting/item-posting.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Las pruebas del catalogo declaran lo que cada articulo comprometio fuera del catalogo. Los
// cambios van en serie, como con la fila bloqueada en la base, y uno que falla no guarda nada.
export class InMemoryItemPosting implements ItemPosting {
  readonly itemsWithStock = new Set<string>();
  readonly itemsWithMovements = new Set<string>();
  // Por articulo, las unidades de sus lineas en ordenes y pedidos abiertos.
  readonly openDocumentUnits = new Map<string, string[]>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly items: ItemRepository) {}

  post(tenantId: TenantId, itemId: ItemId, work: (item: Item, commitments: ItemCommitments) => void): Promise<void> {
    const run = this.queue.then(() => this.postNow(tenantId, itemId, work));

    this.queue = run.catch(() => undefined);

    return run;
  }

  private async postNow(tenantId: TenantId, itemId: ItemId, work: (item: Item, commitments: ItemCommitments) => void): Promise<void> {
    const item = await this.items.find(tenantId, itemId);

    if (!item) throw new ItemNotFoundError(itemId.value);

    work(item, {
      hasStock: this.itemsWithStock.has(itemId.value),
      hasMovements: this.itemsWithMovements.has(itemId.value),
      openDocumentUnits: [...new Set(this.openDocumentUnits.get(itemId.value) ?? [])].sort().map((unitId) => MeasurementUnitId.of(unitId)),
    });

    await this.items.save(item);
  }
}
