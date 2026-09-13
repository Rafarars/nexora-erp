import { describe, expect, it } from 'vitest';
import { SequentialIdGenerator } from '../../../../../shared/infrastructure/testing/sequential-id-generator.js';
import { InsufficientStockError } from '../../errors/inventory.errors.js';
import { InventoryMovement } from '../../movement/inventory-movement.entity.js';
import { Quantity } from '../../quantity/quantity.vo.js';
import { UnitCost } from '../../quantity/unit-cost.vo.js';
import { ItemRef, WarehouseRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { MAIN, NORTH, NOW, TENANT_A, WATER } from '../../testing/inventory.mother.js';
import { ItemStock } from '../item-stock.entity.js';
import { Ledger } from './stock-ledger.js';
import { StockMovements } from './stock-movements.js';

// Un libro en memoria: existencias vacias que se crean al pedirlas y los movimientos ya escritos.
function aLedger(previous: InventoryMovement[] = []): Ledger & { stocks: Map<string, ItemStock> } {
  const stocks = new Map<string, ItemStock>();

  return {
    stocks,
    stock: (itemId, warehouseId) => {
      const key = `${itemId.value}|${warehouseId.value}`;
      const stock = stocks.get(key) ?? ItemStock.empty(TenantId.of(TENANT_A), itemId, warehouseId, NOW);

      stocks.set(key, stock);

      return stock;
    },
    movementsOf: () => previous,
  };
}

const entry = (warehouse: string, direction: 'in' | 'out', quantity: number, unitCost: number | null = null) => ({
  lineId: `11111111-cccc-4ccc-8ccc-${warehouse.slice(0, 1)}${direction}${quantity}`.padEnd(36, '0').slice(0, 36),
  itemId: ItemRef.of(WATER),
  warehouseId: WarehouseRef.of(warehouse),
  direction,
  quantity: Quantity.of(quantity),
  unitCost: unitCost === null ? null : UnitCost.of(unitCost),
});

describe('StockMovements', () => {
  // Por articulo Y bodega: una entrada de compra podria tocar el mismo articulo en dos bodegas.
  it('keeps one stock per item and warehouse and writes each movement with its document', () => {
    const ledger = aLedger();

    const changes = new StockMovements(new SequentialIdGenerator()).record(
      ledger,
      { type: 'receipt', id: 'eb000000-0000-4000-8000-000000000001' },
      [entry(MAIN, 'in', 10, 2), entry(NORTH, 'in', 4, 3), entry(MAIN, 'out', 3)],
      NOW,
    );

    expect(changes.stocks.map((stock) => [stock.warehouseId.value, stock.available().toNumber()])).toEqual([
      [MAIN, 7],
      [NORTH, 4],
    ]);
    expect(changes.movements.map((m) => m.toPrimitives())).toMatchObject([
      { originType: 'receipt', warehouseId: MAIN, sequence: 1, balanceQuantity: 10 },
      { originType: 'receipt', warehouseId: NORTH, sequence: 1, balanceQuantity: 4 },
      { originType: 'receipt', warehouseId: MAIN, sequence: 2, direction: 'out', unitCost: 2 },
    ]);
  });

  it('values an entry without cost at the current average', () => {
    const ledger = aLedger();
    const movements = new StockMovements(new SequentialIdGenerator());
    movements.record(ledger, { type: 'adjustment', id: 'ad000000-0000-4000-8000-000000000001' }, [entry(MAIN, 'in', 10, 2)], NOW);

    const { movements: [found] } = movements.record(ledger, { type: 'adjustment', id: 'ad000000-0000-4000-8000-000000000002' }, [entry(MAIN, 'in', 5)], NOW);

    expect(found.unitCost.toNumber()).toBe(2);
  });

  it('reverses what a document wrote, last first, citing each original and skipping reversals', () => {
    const ledger = aLedger();
    const movements = new StockMovements(new SequentialIdGenerator());
    const document = { type: 'receipt' as const, id: 'eb000000-0000-4000-8000-000000000001' };
    const written = movements.record(ledger, document, [entry(MAIN, 'in', 10, 2), entry(MAIN, 'out', 4)], NOW).movements;

    const { movements: reversals } = movements.reverse(aLedgerSharing(ledger, written), document, NOW);

    expect(reversals.map((m) => [m.direction, m.quantity.toNumber(), m.reversalOfId?.value])).toEqual([
      ['in', 4, written[1].id.value],
      ['out', 10, written[0].id.value],
    ]);
    expect(ledger.stock(ItemRef.of(WATER), WarehouseRef.of(MAIN)).available().isZero()).toBe(true);
  });

  it('refuses to reverse an entry whose goods already left', () => {
    const ledger = aLedger();
    const movements = new StockMovements(new SequentialIdGenerator());
    const document = { type: 'receipt' as const, id: 'eb000000-0000-4000-8000-000000000001' };
    const written = movements.record(ledger, document, [entry(MAIN, 'in', 10, 2)], NOW).movements;
    movements.record(ledger, { type: 'adjustment', id: 'ad000000-0000-4000-8000-000000000009' }, [entry(MAIN, 'out', 6)], NOW);

    expect(() => movements.reverse(aLedgerSharing(ledger, written), document, NOW)).toThrow(InsufficientStockError);
  });
});

// El mismo libro, pero sabiendo que movimientos escribio el documento que se revierte.
function aLedgerSharing(ledger: ReturnType<typeof aLedger>, previous: InventoryMovement[]): Ledger {
  return { stock: ledger.stock, movementsOf: () => previous };
}
