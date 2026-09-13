import { describe, expect, it } from 'vitest';
import {
  AdjustmentNotConfirmableError,
  AdjustmentNotEditableError,
  AdjustmentNotFoundError,
  InactiveStockItemError,
  InsufficientStockError,
  StockItemNotFoundError,
  StockWarehouseNotFoundError,
} from '../domain/errors/inventory.errors.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { BOX, FOREIGN_WAREHOUSE, MAIN, NORTH, PIECE, TENANT_A, TENANT_B, WATER } from '../domain/testing/inventory.mother.js';
import { AdjustmentCanceller } from './cancel-adjustment/adjustment-canceller.js';
import { AdjustmentConfirmer } from './confirm-adjustment/adjustment-confirmer.js';
import { AdjustmentCreator, AdjustmentCreatorRequest } from './create-adjustment/adjustment-creator.js';
import { AdjustmentSearcher } from './search-adjustments/adjustment-searcher.js';
import { MovementSearcher } from './search-movements/movement-searcher.js';
import { StockSearcher } from './search-stock/stock-searcher.js';
import { InventoryScenario, anInventoryScenario } from './testing/inventory-scenario.js';
import { AdjustmentUpdater } from './update-adjustment/adjustment-updater.js';

// Los casos de uso del inventario juntos, porque su valor esta en como se encadenan: crear,
// confirmar, consultar, anular y volver a consultar.
function useCases(s: InventoryScenario) {
  return {
    create: new AdjustmentCreator(s.factory, s.store, s.codes, s.ids, s.clock),
    update: new AdjustmentUpdater(s.finder, s.factory, s.store, s.clock),
    confirm: new AdjustmentConfirmer(s.finder, s.factory, s.store, s.store, s.confirmation, s.clock),
    cancel: new AdjustmentCanceller(s.store, s.cancellation, s.clock),
    adjustments: new AdjustmentSearcher(s.store, s.catalog),
    stock: new StockSearcher(s.store, s.catalog),
    kardex: new MovementSearcher(s.store, s.store, s.catalog),
  };
}

function request(overrides: Partial<AdjustmentCreatorRequest> = {}): AdjustmentCreatorRequest {
  return {
    tenantId: TENANT_A,
    warehouseId: MAIN,
    notes: 'Conteo inicial',
    lines: [{ itemId: WATER, unitId: BOX, direction: 'in', quantity: 10, unitCost: 12 }],
    ...overrides,
  };
}

async function created(s: InventoryScenario, overrides: Partial<AdjustmentCreatorRequest> = {}) {
  await useCases(s).create.run(request(overrides));
  const [latest] = await s.store.searchByTenant(TenantId.of(TENANT_A));

  return latest.id.value;
}

describe('creating and editing a draft', () => {
  it('creates a draft with its code, today as date and base quantities', async () => {
    const s = anInventoryScenario();
    await created(s);

    const { adjustments } = await useCases(s).adjustments.run({ tenantId: TENANT_A });

    expect(adjustments).toMatchObject([
      {
        code: 'AJU000001',
        warehouse: { id: MAIN, name: 'Principal' },
        date: '2026-01-15',
        status: 'draft',
        lines: [{ sku: 'AGUA-500', unitAbbreviation: 'cja', quantity: 10, baseQuantity: 240, unitCost: 12 }],
      },
    ]);
  });

  it('does not touch the stock while it is a draft', async () => {
    const s = anInventoryScenario();
    await created(s);

    expect(await useCases(s).stock.run({ tenantId: TENANT_A })).toEqual({ stocks: [] });
  });

  it('does not consume a code when the draft is invalid', async () => {
    const s = anInventoryScenario();

    await useCases(s).create.run(request({ warehouseId: FOREIGN_WAREHOUSE })).catch(() => undefined);
    await created(s);

    expect((await s.store.searchByTenant(TenantId.of(TENANT_A)))[0].code).toBe('AJU000001');
  });

  it('replaces the whole draft on edit', async () => {
    const s = anInventoryScenario();
    const id = await created(s);

    await useCases(s).update.run({
      ...request({ warehouseId: NORTH, notes: null, lines: [{ itemId: WATER, unitId: PIECE, direction: 'in', quantity: 3 }] }),
      adjustmentId: id,
    });

    const [adjustment] = (await useCases(s).adjustments.run({ tenantId: TENANT_A })).adjustments;
    expect(adjustment).toMatchObject({ warehouse: { id: NORTH }, notes: null, lines: [{ baseQuantity: 3, unitCost: null }] });
  });

  it('cannot reach an adjustment of another tenant', async () => {
    const s = anInventoryScenario();
    const id = await created(s);

    await expect(useCases(s).confirm.run({ tenantId: TENANT_B, adjustmentId: id })).rejects.toThrow(AdjustmentNotFoundError);
    await expect(useCases(s).cancel.run({ tenantId: TENANT_B, adjustmentId: id })).rejects.toThrow(AdjustmentNotFoundError);
    await expect(useCases(s).update.run({ ...request({ tenantId: TENANT_B }), adjustmentId: id })).rejects.toThrow(
      AdjustmentNotFoundError,
    );
  });
});

describe('confirming', () => {
  it('moves the stock and shows it valued at its average cost', async () => {
    const s = anInventoryScenario();
    await useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: await created(s) });

    expect((await useCases(s).stock.run({ tenantId: TENANT_A })).stocks).toEqual([
      {
        item: { id: WATER, sku: 'AGUA-500', name: 'Agua', baseUnit: 'un' },
        warehouse: { id: MAIN, name: 'Principal' },
        quantity: 240,
        averageCost: 0.5,
        totalValue: 120,
      },
    ]);
  });

  it('shows the kardex of the item with the code of the adjustment', async () => {
    const s = anInventoryScenario();
    await useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: await created(s) });

    const { movements } = await useCases(s).kardex.run({ tenantId: TENANT_A, itemId: WATER });

    expect(movements).toMatchObject([
      { direction: 'in', quantity: 240, balanceQuantity: 240, origin: { code: 'AJU000001' }, isReversal: false, sequence: 1 },
    ]);
  });

  it('refuses an exit larger than the stock and leaves the draft as it was', async () => {
    const s = anInventoryScenario();
    const id = await created(s, { lines: [{ itemId: WATER, unitId: PIECE, direction: 'out', quantity: 1 }] });

    await expect(useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: id })).rejects.toThrow(InsufficientStockError);

    expect((await useCases(s).adjustments.run({ tenantId: TENANT_A })).adjustments[0].status).toBe('draft');
  });

  // El borrador se escribio cuando la caja traia 24; hoy trae 12. Se confirma con lo de hoy.
  it('recalculates base quantities with the conversion the item has today', async () => {
    const s = anInventoryScenario();
    const id = await created(s);
    (s.catalog as unknown as { items: { id: string; units: { conversionFactor: number }[] }[] }).items.find(
      (item) => item.id === WATER,
    )!.units[1].conversionFactor = 12;

    await useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: id });

    expect((await useCases(s).stock.run({ tenantId: TENANT_A })).stocks[0].quantity).toBe(120);
  });

  it('refuses to confirm a draft whose item was deactivated after it was written', async () => {
    const s = anInventoryScenario();
    const id = await created(s);
    (s.catalog as unknown as { items: { id: string; isActive: boolean }[] }).items.find((item) => item.id === WATER)!.isActive = false;

    await expect(useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: id })).rejects.toThrow(InactiveStockItemError);
  });

  it('cannot confirm or edit an adjustment that is already confirmed', async () => {
    const s = anInventoryScenario();
    const id = await created(s);
    await useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: id });

    await expect(useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: id })).rejects.toThrow(AdjustmentNotConfirmableError);
    await expect(useCases(s).update.run({ ...request(), adjustmentId: id })).rejects.toThrow(AdjustmentNotEditableError);
  });
});

describe('cancelling', () => {
  it('brings the stock back and leaves both the movement and its reversal in the kardex', async () => {
    const s = anInventoryScenario();
    const id = await created(s);
    await useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: id });

    await useCases(s).cancel.run({ tenantId: TENANT_A, adjustmentId: id });

    expect((await useCases(s).stock.run({ tenantId: TENANT_A })).stocks[0].quantity).toBe(0);
    expect((await useCases(s).kardex.run({ tenantId: TENANT_A, itemId: WATER })).movements.map((m) => [m.direction, m.isReversal])).toEqual([
      ['in', false],
      ['out', true],
    ]);
  });
});

describe('queries', () => {
  it('filters the stock by warehouse', async () => {
    const s = anInventoryScenario();
    await useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: await created(s) });
    await useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: await created(s, { warehouseId: NORTH }) });

    const { stocks } = await useCases(s).stock.run({ tenantId: TENANT_A, warehouseId: NORTH });

    expect(stocks.map((stock) => stock.warehouse.name)).toEqual(['Norte']);
  });

  it('never shows the stock of another tenant', async () => {
    const s = anInventoryScenario();
    await useCases(s).confirm.run({ tenantId: TENANT_A, adjustmentId: await created(s) });

    expect(await useCases(s).stock.run({ tenantId: TENANT_B })).toEqual({ stocks: [] });
    await expect(useCases(s).kardex.run({ tenantId: TENANT_B, itemId: WATER })).rejects.toThrow(StockItemNotFoundError);
  });

  it('answers not found when filtering by a warehouse of another tenant', async () => {
    const s = anInventoryScenario();

    await expect(useCases(s).stock.run({ tenantId: TENANT_A, warehouseId: FOREIGN_WAREHOUSE })).rejects.toThrow(
      StockWarehouseNotFoundError,
    );
    await expect(useCases(s).kardex.run({ tenantId: TENANT_A, itemId: WATER, warehouseId: FOREIGN_WAREHOUSE })).rejects.toThrow(
      StockWarehouseNotFoundError,
    );
  });

  it('refuses a warehouse of another tenant when creating', async () => {
    const s = anInventoryScenario();

    await expect(useCases(s).create.run(request({ warehouseId: FOREIGN_WAREHOUSE }))).rejects.toThrow(StockWarehouseNotFoundError);
  });
});
