import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SequentialIdGenerator } from '../../../shared/infrastructure/testing/sequential-id-generator.js';
import { AdjustmentDate } from '../domain/adjustment/adjustment-date.vo.js';
import { AdjustmentLine, AdjustmentLineId } from '../domain/adjustment/adjustment-line.js';
import { Adjustment, AdjustmentId } from '../domain/adjustment/adjustment.entity.js';
import { AdjustmentCancellation } from '../domain/adjustment/posting/adjustment-cancellation.js';
import { AdjustmentConfirmation } from '../domain/adjustment/posting/adjustment-confirmation.js';
import {
  AdjustmentAlreadyCancelledError,
  AdjustmentNotEditableError,
  AdjustmentNotFoundError,
  InsufficientStockError,
} from '../domain/errors/inventory.errors.js';
import { Quantity } from '../domain/quantity/quantity.vo.js';
import { UnitCost } from '../domain/quantity/unit-cost.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../domain/shared/references.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { StockMovements } from '../domain/stock/posting/stock-movements.js';

import { MAIN, NORTH, NOW, PIECE, TENANT_A, TENANT_B, TODAY, WATER } from '../domain/testing/inventory.mother.js';
import { InventoryPorts, InventoryPortsHarness } from './inventory-store.harness.js';

const tenant = TenantId.of(TENANT_A);

// UNA suite para el doble y para PostgreSQL. Lo que mas importa aqui no es guardar y leer:
// es que la publicacion sea atomica y serializada de verdad, que es lo que un doble puede
// fingir y la base tiene que cumplir.
export function describeInventoryPortsContract(implementation: string, createHarness: () => InventoryPortsHarness): void {
  describe(`Inventory ports contract: ${implementation}`, () => {
    const harness = createHarness();
    let ports: InventoryPorts;
    let counter = 0;
    const ids = new SequentialIdGenerator();

    beforeEach(async () => {
      await harness.reset();
      ports = harness.ports();
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    function line(direction: 'in' | 'out', quantity: number, unitCost: number | null = null): AdjustmentLine {
      counter += 1;

      return AdjustmentLine.of({
        id: AdjustmentLineId.of(`11111111-bbbb-4bbb-8bbb-${String(counter).padStart(12, '0')}`),
        lineNumber: counter,
        itemId: ItemRef.of(WATER),
        unitId: UnitRef.of(PIECE),
        direction,
        quantity: Quantity.of(quantity),
        baseQuantity: Quantity.of(quantity),
        unitCost: unitCost === null ? null : UnitCost.of(unitCost),
      });
    }

    async function draft(lines: AdjustmentLine[], warehouse = MAIN): Promise<AdjustmentId> {
      counter += 1;
      const id = AdjustmentId.of(`ad000000-0000-4000-8000-${String(counter).padStart(12, '0')}`);

      await ports.adjustments.save(
        Adjustment.draft(id, tenant, `AJU${String(counter).padStart(6, '0')}`, {
          warehouseId: WarehouseRef.of(warehouse),
          date: AdjustmentDate.of(TODAY),
          notes: 'contrato',
          lines,
        }, NOW),
      );

      return id;
    }

    const confirm = (id: AdjustmentId) =>
      ports.posting.post(tenant, id, (adjustment, ledger) => new AdjustmentConfirmation(new StockMovements(ids)).apply(adjustment, ledger, NOW));
    const cancel = (id: AdjustmentId) =>
      ports.posting.post(tenant, id, (adjustment, ledger) => new AdjustmentCancellation(new StockMovements(ids)).apply(adjustment, ledger, NOW));

    async function available(warehouse = MAIN): Promise<number> {
      const [stock] = await ports.stocks.searchStocks(tenant, WarehouseRef.of(warehouse));

      return stock?.available().toNumber() ?? 0;
    }

    // La propiedad del kardex: la existencia es la suma de sus movimientos, y el saldo del
    // ultimo movimiento es la existencia.
    async function expectStockMatchesKardex(): Promise<void> {
      for (const stock of await ports.stocks.searchStocks(tenant)) {
        const movements = await ports.stocks.searchMovements(tenant, stock.itemId, stock.warehouseId);
        const sum = movements.reduce((total, movement) => total + movement.signedUnits(), 0n);

        expect(sum).toBe(stock.available().units);
        expect(movements.at(-1)?.balanceQuantity.units ?? 0n).toBe(stock.available().units);
        expect(movements.map((movement) => movement.sequence)).toEqual(movements.map((_, index) => index + 1));
      }
    }

    describe('AdjustmentRepository', () => {
      it('returns the draft it saved, lines and date included', async () => {
        const id = await draft([line('in', 10.5, 1.25), line('out', 2)]);

        const found = await ports.adjustments.find(tenant, id);

        expect(found?.toPrimitives()).toMatchObject({
          status: 'draft',
          adjustmentDate: TODAY,
          notes: 'contrato',
          lines: [
            { lineNumber: expect.any(Number), direction: 'in', quantity: 10.5, baseQuantity: 10.5, unitCost: 1.25 },
            { direction: 'out', quantity: 2, unitCost: null },
          ],
        });
      });

      it('returns null for an adjustment of another tenant', async () => {
        const id = await draft([line('in', 1)]);

        expect(await ports.adjustments.find(TenantId.of(TENANT_B), id)).toBeNull();
      });

      it('replaces the lines of a draft on save', async () => {
        const id = await draft([line('in', 1), line('in', 2)]);
        const adjustment = (await ports.adjustments.find(tenant, id))!;

        adjustment.update({ warehouseId: WarehouseRef.of(NORTH), date: AdjustmentDate.of(TODAY), notes: null, lines: [line('in', 7)] }, NOW);
        await ports.adjustments.save(adjustment);

        expect((await ports.adjustments.find(tenant, id))?.toPrimitives()).toMatchObject({
          warehouseId: NORTH,
          notes: null,
          lines: [{ quantity: 7 }],
        });
      });

      // Un borrador leido antes de que otro lo confirmara no puede devolverlo a borrador.
      it('refuses to overwrite an adjustment that was confirmed in the meantime', async () => {
        const id = await draft([line('in', 5, 1)]);
        const stale = (await ports.adjustments.find(tenant, id))!;
        await confirm(id);

        stale.update({ warehouseId: WarehouseRef.of(MAIN), date: AdjustmentDate.of(TODAY), notes: 'tarde', lines: [line('in', 1)] }, NOW);

        await expect(ports.adjustments.save(stale)).rejects.toThrow(AdjustmentNotEditableError);
        expect((await ports.adjustments.find(tenant, id))?.currentStatus()).toBe('confirmed');
      });

      it('lists the adjustments of the tenant, latest code first', async () => {
        await draft([line('in', 1)]);
        await draft([line('in', 1)]);

        const codes = (await ports.adjustments.searchByTenant(tenant)).map((adjustment) => adjustment.code);

        expect(codes).toEqual([...codes].sort().reverse());
        expect(await ports.adjustments.searchByTenant(TenantId.of(TENANT_B))).toEqual([]);
      });
    });

    describe('AdjustmentPosting', () => {
      it('confirms: writes status, movements and stock together', async () => {
        const id = await draft([line('in', 10, 2), line('out', 3)]);

        await confirm(id);

        expect((await ports.adjustments.find(tenant, id))?.currentStatus()).toBe('confirmed');
        expect(await available()).toBe(7);
        expect((await ports.stocks.searchMovements(tenant, ItemRef.of(WATER))).map((m) => m.toPrimitives())).toMatchObject([
          { direction: 'in', quantity: 10, unitCost: 2, balanceQuantity: 10, sequence: 1, originId: id.value },
          { direction: 'out', quantity: 3, unitCost: 2, balanceQuantity: 7, sequence: 2, originId: id.value },
        ]);
        await expectStockMatchesKardex();
      });

      // Atomicidad: la segunda linea no alcanza y no queda ni la primera, ni el estado, ni
      // la fila de existencia que se creo para bloquearla.
      it('writes nothing at all when the domain work fails', async () => {
        const id = await draft([line('in', 5, 1), line('out', 6)]);

        await expect(confirm(id)).rejects.toThrow(InsufficientStockError);

        expect((await ports.adjustments.find(tenant, id))?.currentStatus()).toBe('draft');
        expect(await ports.stocks.searchStocks(tenant)).toEqual([]);
        expect(await ports.stocks.searchMovements(tenant, ItemRef.of(WATER))).toEqual([]);
      });

      it('answers not found for an adjustment of another tenant', async () => {
        const id = await draft([line('in', 5, 1)]);

        await expect(
          ports.posting.post(TenantId.of(TENANT_B), id, (adjustment, ledger) => new AdjustmentConfirmation(new StockMovements(ids)).apply(adjustment, ledger, NOW)),
        ).rejects.toThrow(AdjustmentNotFoundError);
      });

      it('cancels a confirmed adjustment with reversals and brings the stock back', async () => {
        const id = await draft([line('in', 10, 2), line('out', 4)]);
        await confirm(id);

        await cancel(id);

        const kardex = (await ports.stocks.searchMovements(tenant, ItemRef.of(WATER))).map((m) => m.toPrimitives());
        expect(kardex.map((m) => [m.direction, m.quantity, m.reversalOfId !== null])).toEqual([
          ['in', 10, false],
          ['out', 4, false],
          ['in', 4, true],
          ['out', 10, true],
        ]);
        expect(await available()).toBe(0);
        await expectStockMatchesKardex();
      });

      it('never duplicates a reversal', async () => {
        const id = await draft([line('in', 10, 2)]);
        await confirm(id);
        await cancel(id);

        await expect(cancel(id)).rejects.toThrow(AdjustmentAlreadyCancelledError);
        expect(await ports.stocks.searchMovements(tenant, ItemRef.of(WATER))).toHaveLength(2);
      });

      it('keeps each warehouse with its own stock and its own sequence', async () => {
        await confirm(await draft([line('in', 5, 1)], MAIN));
        await confirm(await draft([line('in', 8, 1)], NORTH));
        await confirm(await draft([line('out', 2)], NORTH));

        expect(await available(MAIN)).toBe(5);
        expect(await available(NORTH)).toBe(6);
        expect(await ports.stocks.searchMovements(tenant, ItemRef.of(WATER), WarehouseRef.of(NORTH))).toHaveLength(2);
        await expectStockMatchesKardex();
      });

      // La guarda de inventario en cero bajo concurrencia real: dos salidas de 6 sobre 10.
      // Sin bloqueo, las dos leerian 10 y las dos pasarian.
      it('lets only one of two concurrent exits through when both do not fit', async () => {
        await confirm(await draft([line('in', 10, 1)]));
        const first = await draft([line('out', 6)]);
        const second = await draft([line('out', 6)]);

        const results = await Promise.allSettled([confirm(first), confirm(second)]);

        expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(
          InsufficientStockError,
        );
        expect(await available()).toBe(4);
        await expectStockMatchesKardex();
      });

      it('confirms an adjustment only once when asked twice at the same time', async () => {
        const id = await draft([line('in', 10, 1)]);

        const results = await Promise.allSettled([confirm(id), confirm(id)]);

        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(await available()).toBe(10);
        await expectStockMatchesKardex();
      });

      it('keeps the stock equal to the kardex after many concurrent adjustments', async () => {
        await confirm(await draft([line('in', 100, 3)]));
        const drafts = await Promise.all(
          Array.from({ length: 12 }, (_, index) => draft(index % 3 === 0 ? [line('in', 2.5, 4)] : [line('out', 7.25)])),
        );

        await Promise.allSettled(drafts.map((id) => confirm(id)));

        await expectStockMatchesKardex();
        expect(await available()).toBeGreaterThanOrEqual(0);
      });
    });

    describe('InventoryCodeSequence', () => {
      it('counts adjustments per tenant', async () => {
        expect(await ports.codes.next(tenant, 'AJU')).toBe(1);
        expect(await ports.codes.next(tenant, 'AJU')).toBe(2);
        expect(await ports.codes.next(TenantId.of(TENANT_B), 'AJU')).toBe(1);
      });
    });
  });
}
