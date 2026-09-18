import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { SequentialIdGenerator } from '../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { ItemFinder } from '../../domain/item/find/item-finder.js';
import { Item } from '../../domain/item/item.entity.js';
import { ItemReferences } from '../../domain/item/references/item-references.js';
import { BarcodeUniqueness } from '../../domain/item/unique/barcode-uniqueness.js';
import { SkuUniqueness } from '../../domain/item/unique/sku-uniqueness.js';
import { NOW, aCategory, aPriceList, aTax, aUnit } from '../../domain/testing/item.mother.js';
import { InMemoryCatalogReferences } from '../../infrastructure/testing/in-memory-catalog-references.js';
import { InMemoryInventoryCodeSequence } from '../../infrastructure/testing/in-memory-inventory-code-sequence.js';
import { InMemoryItemPosting } from '../../infrastructure/testing/in-memory-item-posting.js';
import { InMemoryItemRepository } from '../../infrastructure/testing/in-memory-item.repository.js';

// El mundo de una prueba del maestro de articulos: el catalogo que usa, sembrado a mano, y
// nada de base de datos ni NestJS.
export function anItemScenario(
  seed: {
    categories?: ReturnType<typeof aCategory>[];
    taxes?: ReturnType<typeof aTax>[];
    units?: ReturnType<typeof aUnit>[];
    priceLists?: ReturnType<typeof aPriceList>[];
    items?: Item[];
  } = {},
) {
  const items = new InMemoryItemRepository(seed.items ?? []);
  const catalog = new InMemoryCatalogReferences(
    seed.categories ?? [],
    seed.taxes ?? [],
    seed.units ?? [],
    [],
    seed.priceLists ?? [],
  );

  return {
    items,
    catalog,
    codes: new InMemoryInventoryCodeSequence(),
    ids: new SequentialIdGenerator(),
    clock: new FixedClock(NOW),
    itemFinder: new ItemFinder(items),
    skuUniqueness: new SkuUniqueness(items),
    barcodeUniqueness: new BarcodeUniqueness(items),
    references: new ItemReferences(catalog),
    itemPosting: new InMemoryItemPosting(items),
  };
}

export type ItemScenario = ReturnType<typeof anItemScenario>;
