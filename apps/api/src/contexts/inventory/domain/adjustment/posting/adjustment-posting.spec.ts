import { describe, expect, it } from 'vitest';
import { SequentialIdGenerator } from '../../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { InMemoryInventoryStore } from '../../../infrastructure/testing/in-memory-inventory-store.js';
import { AdjustmentAlreadyCancelledError, InsufficientStockError } from '../../errors/inventory.errors.js';
import { Quantity } from '../../quantity/quantity.vo.js';
import { UnitCost } from '../../quantity/unit-cost.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { BOX, MAIN, NOW, PIECE, TENANT_A, TODAY, WATER } from '../../testing/inventory.mother.js';
import { AdjustmentDate } from '../adjustment-date.vo.js';
import { AdjustmentLine, AdjustmentLineId } from '../adjustment-line.js';
import { Adjustment, AdjustmentId } from '../adjustment.entity.js';
import { StockMovements } from '../../stock/posting/stock-movements.js';
import { AdjustmentCancellation } from './adjustment-cancellation.js';
import { AdjustmentConfirmation } from './adjustment-confirmation.js';

const tenant = TenantId.of(TENANT_A);
let lineCounter = 0;

function line(direction: 'in' | 'out', base: number, unitCost: number | null = null, unit = PIECE, quantity = base): AdjustmentLine {
  lineCounter += 1;

  return AdjustmentLine.of({
    id: AdjustmentLineId.of(`11111111-aaaa-4aaa-8aaa-${String(lineCounter).padStart(12, '0')}`),
    lineNumber: lineCounter,
    itemId: ItemRef.of(WATER),
    unitId: UnitRef.of(unit),
    direction,
    quantity: Quantity.of(quantity),
    baseQuantity: Quantity.of(base),
    unitCost: unitCost === null ? null : UnitCost.of(unitCost),
  });
}

async function draft(store: InMemoryInventoryStore, id: string, lines: AdjustmentLine[]) {
  const adjustment = Adjustment.draft(AdjustmentId.of(id), tenant, `AJU${id.slice(-6)}`, {
    warehouseId: WarehouseRef.of(MAIN),
    date: AdjustmentDate.of(TODAY),
    notes: null,
    lines,
  }, NOW);

  await store.save(adjustment);

  return adjustment.id;
}

function world() {
  const store = new InMemoryInventoryStore(() => NOW);
  const ids = new SequentialIdGenerator();

  return {
    store,
    confirm: (id: AdjustmentId) => store.post(tenant, id, (adjustment, ledger) => new AdjustmentConfirmation(new StockMovements(ids)).apply(adjustment, ledger, NOW)),
    cancel: (id: AdjustmentId) => store.post(tenant, id, (adjustment, ledger) => new AdjustmentCancellation(new StockMovements(ids)).apply(adjustment, ledger, NOW)),
    available: async () => (await store.searchStocks(tenant))[0]?.available().toNumber() ?? 0,
    kardex: async () => (await store.searchMovements(tenant, ItemRef.of(WATER))).map((m) => m.toPrimitives()),
  };
}

const A1 = 'ad000000-0000-4000-8000-000000000001';
const A2 = 'ad000000-0000-4000-8000-000000000002';

describe('confirming an adjustment', () => {
  it('moves the stock and writes one movement per line', async () => {
    const w = world();
    const id = await draft(w.store, A1, [line('in', 48, 12, BOX, 2), line('out', 8)]);

    await w.confirm(id);

    expect(await w.available()).toBe(40);
    expect(await w.kardex()).toMatchObject([
      { direction: 'in', quantity: 48, unitCost: 0.5, balanceQuantity: 48, originId: A1 },
      { direction: 'out', quantity: 8, unitCost: 0.5, balanceQuantity: 40, originId: A1 },
    ]);
    expect((await w.store.find(tenant, id))?.currentStatus()).toBe('confirmed');
  });

  // Todo o nada: la segunda linea no alcanza y la primera tampoco queda escrita.
  it('writes nothing when one exit does not fit', async () => {
    const w = world();
    const id = await draft(w.store, A1, [line('in', 5, 1), line('out', 6)]);

    await expect(w.confirm(id)).rejects.toThrow(InsufficientStockError);

    expect(await w.available()).toBe(0);
    expect(await w.kardex()).toEqual([]);
    expect((await w.store.find(tenant, id))?.currentStatus()).toBe('draft');
  });

  it('values an entry without cost at the current average', async () => {
    const w = world();
    await w.confirm(await draft(w.store, A1, [line('in', 10, 3)]));

    await w.confirm(await draft(w.store, A2, [line('in', 10)]));

    expect((await w.kardex()).at(-1)).toMatchObject({ unitCost: 3, balanceAverageCost: 3 });
  });
});

describe('cancelling an adjustment', () => {
  it('discards a draft without touching the stock', async () => {
    const w = world();
    const id = await draft(w.store, A1, [line('in', 5, 1)]);

    await w.cancel(id);

    expect((await w.store.find(tenant, id))?.currentStatus()).toBe('cancelled');
    expect(await w.kardex()).toEqual([]);
  });

  // El kardex no se borra: se escribe la contrapartida y el saldo vuelve a donde estaba.
  it('reverses a confirmed adjustment with movements that cite the originals', async () => {
    const w = world();
    const id = await draft(w.store, A1, [line('in', 10, 2), line('out', 4)]);
    await w.confirm(id);

    await w.cancel(id);

    const kardex = await w.kardex();
    expect(kardex).toHaveLength(4);
    expect(kardex.slice(2).map((m) => [m.direction, m.quantity, m.reversalOfId])).toEqual([
      ['in', 4, kardex[1].id],
      ['out', 10, kardex[0].id],
    ]);
    expect(await w.available()).toBe(0);
  });

  it('refuses to reverse when the goods already left through another adjustment', async () => {
    const w = world();
    const entry = await draft(w.store, A1, [line('in', 10, 2)]);
    await w.confirm(entry);
    await w.confirm(await draft(w.store, A2, [line('out', 7)]));

    await expect(w.cancel(entry)).rejects.toThrow(InsufficientStockError);

    expect(await w.available()).toBe(3);
    expect((await w.store.find(tenant, entry))?.currentStatus()).toBe('confirmed');
  });

  it('cannot be cancelled twice, so the reversal is never duplicated', async () => {
    const w = world();
    const id = await draft(w.store, A1, [line('in', 10, 2)]);
    await w.confirm(id);
    await w.cancel(id);

    await expect(w.cancel(id)).rejects.toThrow(AdjustmentAlreadyCancelledError);
    expect(await w.kardex()).toHaveLength(2);
  });
});

// Dos confirmaciones del mismo ajuste a la vez: la segunda ve el ajuste ya confirmado.
it('confirms an adjustment once even when asked twice at the same time', async () => {
  const w = world();
  const id = await draft(w.store, A1, [line('in', 10, 2)]);

  const results = await Promise.allSettled([w.confirm(id), w.confirm(id)]);

  expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
  expect(await w.available()).toBe(10);
});
