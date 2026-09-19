import { describe, expect, it } from 'vitest';
import { ItemReorderRules } from '../domain/item/item-reorder-rules.js';
import { MAIN, PIECE, TENANT_A, WATER } from '../domain/testing/inventory.mother.js';
import { anItem } from '../domain/testing/item.mother.js';
import { InMemoryExpectedStock } from '../infrastructure/testing/in-memory-expected-stock.js';
import { InMemoryItemRepository } from '../infrastructure/testing/in-memory-item.repository.js';
import { LowStockSearcher } from './search-low-stock/low-stock-searcher.js';
import { ANA, anInventoryScenario } from './testing/inventory-scenario.js';
import { AdjustmentConfirmer } from './confirm-adjustment/adjustment-confirmer.js';
import { AdjustmentCreator } from './create-adjustment/adjustment-creator.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';

const FIRST_PAGE = { text: null, warehouseId: null, status: null, type: null, from: null, to: null, limit: 20, offset: 0 };

// El agua tiene minimo 300 en la Principal y entran 200: falta reponer.
async function world(minQuantity = 300, reorderQuantity = 600, expected: { reserved: number; incoming: number } = { reserved: 0, incoming: 0 }) {
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
    userId: ANA,
    warehouseId: MAIN,
    type: 'physical_count',
    notes: 'Conteo inicial',
    lines: [{ itemId: WATER, unitId: PIECE, direction: 'in', quantity: 200, unitCost: 1 }],
  });

  const { adjustments: [adjustment] } = await s.store.search(TenantId.of(TENANT_A), FIRST_PAGE);
  await confirm.run({ tenantId: TENANT_A, userId: ANA, adjustmentId: adjustment.id.value });

  const pending = new InMemoryExpectedStock([{ tenantId: TENANT_A, itemId: WATER, warehouseId: MAIN, ...expected }]);

  return { s, searcher: new LowStockSearcher(items, s.store, s.catalog, pending) };
}

describe('items below their minimum', () => {
  it('lists what is missing and what to order in each warehouse', async () => {
    const { searcher } = await world();

    expect((await searcher.run({ tenantId: TENANT_A })).rows).toEqual([
      expect.objectContaining({ quantity: 200, projected: 200, minQuantity: 300, maxQuantity: 900, missing: 100, suggested: 600 }),
    ]);
  });

  // Lo que ya viene del proveedor no hay que volver a pedirlo: con 150 en camino, la proyectada
  // llega a 350 y el articulo deja de avisar. Comparar contra lo fisico mandaba a comprar dos veces.
  it('does not ask to buy again what a purchase order is already bringing', async () => {
    const { searcher } = await world(300, 600, { reserved: 0, incoming: 150 });

    expect((await searcher.run({ tenantId: TENANT_A })).rows).toEqual([]);
  });

  // Y lo que ya esta vendido no esta disponible para nadie mas: con 80 reservados, de los 200
  // solo quedan 120 y falta el doble de lo que decia la existencia fisica.
  it('counts what confirmed orders already reserved', async () => {
    const { searcher } = await world(300, 0, { reserved: 80, incoming: 0 });

    expect((await searcher.run({ tenantId: TENANT_A })).rows[0]).toMatchObject({
      quantity: 200,
      reserved: 80,
      incoming: 0,
      projected: 120,
      missing: 180,
      suggested: 780,
    });
  });

  // Sin cantidad a pedir se sugiere llegar al maximo; con la existencia por encima, no aparece.
  it('suggests reaching the maximum when no reorder quantity is set, and hides what is above the minimum', async () => {
    expect((await (await world(300, 0)).searcher.run({ tenantId: TENANT_A })).rows[0]).toMatchObject({ suggested: 700 });
    expect((await (await world(100)).searcher.run({ tenantId: TENANT_A })).rows).toEqual([]);
  });
});
