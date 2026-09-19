import { ConcurrentModificationError } from '../../../shared/domain/concurrent-modification.error.js';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SequentialIdGenerator } from '../../../shared/infrastructure/testing/sequential-id-generator.js';
import { AdjustmentDate } from '../domain/adjustment/adjustment-date.vo.js';
import { AdjustmentLine, AdjustmentLineId } from '../domain/adjustment/adjustment-line.js';
import { Adjustment, AdjustmentId } from '../domain/adjustment/adjustment.entity.js';
import { AdjustmentCriteria } from '../domain/adjustment/adjustment.repository.js';
import { AdjustmentCancellation } from '../domain/adjustment/posting/adjustment-cancellation.js';
import { AdjustmentConfirmation } from '../domain/adjustment/posting/adjustment-confirmation.js';
import {
  AdjustmentAlreadyCancelledError,
  AdjustmentNotEditableError,
  AdjustmentNotFoundError,
  InactiveStockItemError,
  InsufficientStockError,
  StockItemChangedError,
  UnknownEntryCostError,
} from '../domain/errors/inventory.errors.js';
import { Quantity } from '../domain/quantity/quantity.vo.js';
import { UnitCost } from '../domain/quantity/unit-cost.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../domain/shared/references.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { StockMovements } from '../domain/stock/posting/stock-movements.js';

import { ANA, BETO, BOX, MAIN, NORTH, NOW, PIECE, TENANT_A, TENANT_B, TODAY, WATER } from '../domain/testing/inventory.mother.js';
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
        itemSku: 'PRUEBA-SKU',
        itemName: 'Articulo de prueba',
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
          type: 'correction',
          notes: 'contrato',
          lines,
        }, NOW, TODAY, ANA),
      );

      return id;
    }

    const page = (overrides: Partial<AdjustmentCriteria> = {}): AdjustmentCriteria => ({
      text: null,
      warehouseId: null,
      status: null,
      type: null,
      from: null,
      to: null,
      limit: 20,
      offset: 0,
      ...overrides,
    });

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

      it('replaces the lines of a draft on save, and its reason with them', async () => {
        const id = await draft([line('in', 1), line('in', 2)]);
        const adjustment = (await ports.adjustments.find(tenant, id))!;

        adjustment.update({ warehouseId: WarehouseRef.of(NORTH), date: AdjustmentDate.of(TODAY), type: 'theft', notes: null, lines: [line('in', 7)] }, NOW, TODAY);
        await ports.adjustments.save(adjustment);

        expect((await ports.adjustments.find(tenant, id))?.toPrimitives()).toMatchObject({
          warehouseId: NORTH,
          type: 'theft',
          notes: null,
          lines: [{ quantity: 7 }],
        });
      });

      // Quien registro se guarda al crear; quien confirmo o anulo, al publicar.
      it('keeps who registered the draft and who closed it', async () => {
        const id = await draft([line('in', 5, 1)]);

        expect((await ports.adjustments.find(tenant, id))?.toPrimitives()).toMatchObject({ createdBy: ANA, confirmedBy: null });

        await ports.posting.post(tenant, id, (adjustment, ledger) =>
          new AdjustmentConfirmation(new StockMovements(ids)).apply(adjustment, ledger, NOW, ANA),
        );

        expect((await ports.adjustments.find(tenant, id))?.toPrimitives()).toMatchObject({ confirmedBy: ANA, cancelledBy: null });

        await ports.posting.post(tenant, id, (adjustment, ledger) =>
          new AdjustmentCancellation(new StockMovements(ids)).apply(adjustment, ledger, NOW, ANA),
        );

        expect((await ports.adjustments.find(tenant, id))?.toPrimitives()).toMatchObject({ cancelledBy: ANA });
      });

      // Dos personas con el mismo borrador: la segunda que guarda no borra lo que guardo la primera.
      it('refuses to overwrite a draft that someone else saved in the meantime', async () => {
        const id = await draft([line('in', 5, 1)]);
        const first = (await ports.adjustments.find(tenant, id))!;
        const second = (await ports.adjustments.find(tenant, id))!;
        const details = (notes: string) => ({ warehouseId: WarehouseRef.of(MAIN), date: AdjustmentDate.of(TODAY), type: 'correction' as const, notes, lines: [line('in', 1)] });

        first.update(details('primero'), new Date(NOW.getTime() + 1000), TODAY);
        await ports.adjustments.save(first);
        second.update(details('segundo'), new Date(NOW.getTime() + 2000), TODAY);

        await expect(ports.adjustments.save(second)).rejects.toThrow(ConcurrentModificationError);
        expect((await ports.adjustments.find(tenant, id))?.toPrimitives().notes).toBe('primero');
      });

      // Un borrador leido antes de que otro lo confirmara no puede devolverlo a borrador.
      it('refuses to overwrite an adjustment that was confirmed in the meantime', async () => {
        const id = await draft([line('in', 5, 1)]);
        const stale = (await ports.adjustments.find(tenant, id))!;
        await confirm(id);

        stale.update({ warehouseId: WarehouseRef.of(MAIN), date: AdjustmentDate.of(TODAY), type: 'correction', notes: 'tarde', lines: [line('in', 1)] }, NOW, TODAY);

        await expect(ports.adjustments.save(stale)).rejects.toThrow(AdjustmentNotEditableError);
        expect((await ports.adjustments.find(tenant, id))?.currentStatus()).toBe('confirmed');
      });

      it('lists the adjustments of the tenant, latest code first', async () => {
        await draft([line('in', 1)]);
        await draft([line('in', 1)]);

        const codes = (await ports.adjustments.search(tenant, page())).adjustments.map((adjustment) => adjustment.code);

        expect(codes).toEqual([...codes].sort().reverse());
        expect((await ports.adjustments.search(TenantId.of(TENANT_B), page())).adjustments).toEqual([]);
      });

      // Sin paginar, el listado traia todos los ajustes de la empresa con todas sus lineas.
      it('returns one page at a time and says how many match in total', async () => {
        await draft([line('in', 1)]);
        await draft([line('in', 1)]);
        await draft([line('in', 1)]);

        const first = await ports.adjustments.search(tenant, page({ limit: 2 }));
        const second = await ports.adjustments.search(tenant, page({ limit: 2, offset: 2 }));

        expect(first.adjustments).toHaveLength(2);
        expect(second.adjustments).toHaveLength(1);
        expect([first.total, second.total]).toEqual([3, 3]);
        expect(first.adjustments.map((a) => a.code)).not.toContain(second.adjustments[0].code);
      });

      it('filters by warehouse, status, reason, dates and text, and counts only what matches', async () => {
        const kept = await draft([line('in', 1)], NORTH);
        await draft([line('in', 1)]);
        await confirm(await draft([line('in', 1, 1)]));

        const byWarehouse = await ports.adjustments.search(tenant, page({ warehouseId: NORTH }));
        const byStatus = await ports.adjustments.search(tenant, page({ status: 'confirmed' }));
        const byType = await ports.adjustments.search(tenant, page({ type: 'loss' }));
        const byText = await ports.adjustments.search(tenant, page({ text: 'contrato' }));
        const byFuture = await ports.adjustments.search(tenant, page({ from: '2099-01-01' }));

        expect(byWarehouse.adjustments.map((a) => a.id.value)).toEqual([kept.value]);
        expect(byWarehouse.total).toBe(1);
        expect(byStatus.adjustments.map((a) => a.currentStatus())).toEqual(['confirmed']);
        expect(byType.adjustments).toEqual([]);
        expect(byText.total).toBe(3);
        expect(byFuture.adjustments).toEqual([]);
      });
    });

    // Un puerto sin contrato es un adaptador sin probar, por pequeno que parezca.
    describe('DocumentAuthors', () => {
      it('names the people of the company', async () => {
        expect(await ports.authors.namesOf(tenant, [ANA])).toEqual(new Map([[ANA, 'Ana Rivas']]));
      });

      // Quien no pertenece a la empresa no se nombra en sus documentos, ni por error.
      it('leaves out anyone who is not a member of the company', async () => {
        const names = await ports.authors.namesOf(tenant, [ANA, BETO]);

        expect(names.has(BETO)).toBe(false);
        expect(names.get(ANA)).toBe('Ana Rivas');
      });

      it('answers an empty map when nobody is asked for', async () => {
        expect(await ports.authors.namesOf(tenant, [])).toEqual(new Map());
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

      // Una entrada sin costo en una bodega donde el articulo nunca estuvo: el promedio de esa
      // bodega es cero, y valorarla en cero regalaria la mercancia.
      it('values an entry without cost at what the item costs in the other warehouses', async () => {
        await confirm(await draft([line('in', 30, 4), line('in', 10, 8)]));

        await confirm(await draft([line('in', 5)], NORTH));

        const kardex = (await ports.stocks.searchMovements(tenant, ItemRef.of(WATER))).map((m) => m.toPrimitives());
        expect(kardex.at(-1)).toMatchObject({ warehouseId: NORTH, unitCost: 5, balanceAverageCost: 5 });
        await expectStockMatchesKardex();
      });

      // La fecha del documento viaja como dia, sin hora ni zona: escrita en una columna DATE y
      // leida de vuelta tiene que ser la misma, no la vispera.
      it('keeps the date the adjustment declares, apart from the instant it was posted', async () => {
        counter += 1;
        const id = AdjustmentId.of(`ad000000-0000-4000-8000-${String(counter).padStart(12, '0')}`);
        await ports.adjustments.save(
          Adjustment.draft(id, tenant, `AJU${String(counter).padStart(6, '0')}`, {
            warehouseId: WarehouseRef.of(MAIN),
            date: AdjustmentDate.of('2025-11-30'),
            type: 'correction',
            notes: 'contrato',
            lines: [line('in', 10, 2)],
          }, NOW, TODAY),
        );

        await confirm(id);

        const kardex = (await ports.stocks.searchMovements(tenant, ItemRef.of(WATER))).map((m) => m.toPrimitives());
        expect(kardex.at(-1)).toMatchObject({ originDate: '2025-11-30', occurredAt: NOW });
      });

      it('refuses an entry without cost when the item has no stock in any warehouse', async () => {
        const id = await draft([line('in', 5)]);

        await expect(confirm(id)).rejects.toThrow(UnknownEntryCostError);

        expect((await ports.adjustments.find(tenant, id))?.currentStatus()).toBe('draft');
        expect(await ports.stocks.searchStocks(tenant)).toEqual([]);
      });

      // Entre la revalidacion del borrador y el bloqueo, la caja del articulo pudo cambiar: una caja
      // de 24 anotada como 12 es lo que quedaria.
      it('refuses base quantities that no longer match the unit of the item, and writes nothing', async () => {
        counter += 1;
        const boxAsTwelve = AdjustmentLine.of({
          id: AdjustmentLineId.of(`11111111-bbbb-4bbb-8bbb-${String(counter).padStart(12, '0')}`),
          lineNumber: 1,
          itemId: ItemRef.of(WATER),
          itemSku: 'PRUEBA-SKU',
          itemName: 'Articulo de prueba',
          unitId: UnitRef.of(BOX),
          direction: 'in',
          quantity: Quantity.of(1),
          baseQuantity: Quantity.of(12),
          unitCost: UnitCost.of(1),
        });
        const id = await draft([boxAsTwelve]);

        await expect(confirm(id)).rejects.toThrow(StockItemChangedError);
        expect((await ports.adjustments.find(tenant, id))?.currentStatus()).toBe('draft');
        expect(await ports.stocks.searchStocks(tenant)).toEqual([]);
      });

      // Un articulo que ya no se ofrece no mueve existencia, tampoco para anular.
      it('refuses to move the stock of an item deactivated after it was validated', async () => {
        const entry = await draft([line('in', 5, 1)]);
        await confirm(entry);
        await harness.deactivateItem(WATER);
        const exit = await draft([line('out', 5)]);

        await expect(confirm(exit)).rejects.toThrow(InactiveStockItemError);
        await expect(cancel(entry)).rejects.toThrow(InactiveStockItemError);
        expect(await available()).toBe(5);
        await expectStockMatchesKardex();
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
