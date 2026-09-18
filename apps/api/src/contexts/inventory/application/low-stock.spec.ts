import { describe, expect, it } from 'vitest';
import { ItemReorderRules } from '../domain/item/item-reorder-rules.js';
import { MAIN, PIECE, TENANT_A, WATER } from '../domain/testing/inventory.mother.js';
import { anItem } from '../domain/testing/item.mother.js';
import { InMemoryItemRepository } from '../infrastructure/testing/in-memory-item.repository.js';
import { LowStockSearcher } from './search-low-stock/low-stock-searcher.js';
import { anInventoryScenario } from './testing/inventory-scenario.js';
import { AdjustmentConfirmer } from './confirm-adjustment/adjustment-confirmer.js';
import { AdjustmentCreator } from './create-adjustment/adjustment-creator.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';

// El agua tiene minimo 300 en la Principal y entran 200: falta reponer.
async function world(minQuantity = 300, reorderQuantity = 600) {
  const s = anInventoryScenario();
  const items = new InMemoryItemRepository([
    anItem({
      id: WATER,
      tenantId: TENANT_A,
      sku: 'AGUA-500',
      reorderRules: ItemReorderRules.fromPrimitives([{ warehouseId: MAIN, minQuantity, maxQuantity: 900, reorderQuantity }]),
    }),
  ]);
  const create = new AdjustmentCreator(s.factory, s.store, s.codes, s.ids, s.clock, s.calendar);
  const confirm = new AdjustmentConfirmer(s.finder, s.factory, s.store, s.store, s.confirmation, s.clock, s.calendar);

  await create.run({
    tenantId: TENANT_A,
    warehouseId: MAIN,
    notes: 'Conteo inicial',
    lines: [{ itemId: WATER, unitId: PIECE, direction: 'in', quantity: 200, unitCost: 1 }],
  });

  const [adjustment] = await s.store.searchByTenant(TenantId.of(TENANT_A));
  await confirm.run({ tenantId: TENANT_A, adjustmentId: adjustment.id.value });

  return { s, searcher: new LowStockSearcher(items, s.store, s.catalog) };
}

describe('items below their minimum', () => {
  it('lists what is missing and what to order in each warehouse', async () => {
    const { searcher } = await world();

    expect((await searcher.run({ tenantId: TENANT_A })).rows).toEqual([
      expect.objectContaining({ quantity: 200, minQuantity: 300, maxQuantity: 900, missing: 100, suggested: 600 }),
    ]);
  });

  // Sin cantidad a pedir se sugiere llegar al maximo; con la existencia por encima, no aparece.
  it('suggests reaching the maximum when no reorder quantity is set, and hides what is above the minimum', async () => {
    expect((await (await world(300, 0)).searcher.run({ tenantId: TENANT_A })).rows[0]).toMatchObject({ suggested: 700 });
    expect((await (await world(100)).searcher.run({ tenantId: TENANT_A })).rows).toEqual([]);
  });
});
