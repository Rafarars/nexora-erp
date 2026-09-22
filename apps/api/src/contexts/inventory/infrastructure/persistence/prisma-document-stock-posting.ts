import { Inject, Injectable } from '@nestjs/common';
import type { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { ID_GENERATOR } from '../../../../shared/domain/ports/id-generator.js';
import type {
  DocumentStockEntry,
  DocumentStockExit,
  DocumentStockMovement,
  DocumentStockPosting,
  DocumentStockRestore,
  StockDocument,
  TransactionClient,
} from '../../../../shared/prisma/document-stock-posting.js';
import { Quantity } from '../../domain/quantity/quantity.vo.js';
import { UnitCost } from '../../domain/quantity/unit-cost.vo.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { StockMovements } from '../../domain/stock/posting/stock-movements.js';
import { movementFromRow } from './inventory-rows.js';
import { lockedLedger, movementsOf, writeChanges } from './prisma-stock-ledger.js';

// La puerta por la que otros contextos mueven existencia. Traduce su vocabulario al del
// inventario y usa el mismo motor y el mismo bloqueo que el ajuste.
@Injectable()
export class PrismaDocumentStockPosting implements DocumentStockPosting {
  private readonly movements: StockMovements;

  constructor(@Inject(ID_GENERATOR) ids: IdGenerator) {
    this.movements = new StockMovements(ids);
  }

  async receive(tx: TransactionClient, tenantId: string, document: StockDocument, entries: DocumentStockEntry[], now: Date): Promise<void> {
    const ledger = await lockedLedger(
      tx,
      tenantId,
      entries.map((entry) => [entry.itemId, entry.warehouseId]),
      [],
    );
    const changes = this.movements.record(
      ledger,
      document,
      entries.map((entry) => ({
        lineId: entry.lineId,
        itemId: ItemRef.of(entry.itemId),
        warehouseId: WarehouseRef.of(entry.warehouseId),
        direction: 'in' as const,
        quantity: Quantity.of(entry.quantity),
        unitCost: UnitCost.of(entry.unitCost),
      })),
      now,
    );

    await writeChanges(tx, tenantId, changes);
  }

  async release(tx: TransactionClient, tenantId: string, document: StockDocument, exits: DocumentStockExit[], now: Date): Promise<void> {
    const ledger = await lockedLedger(
      tx,
      tenantId,
      exits.map((exit) => [exit.itemId, exit.warehouseId]),
      [],
    );
    const changes = this.movements.record(
      ledger,
      document,
      exits.map((exit) => ({
        lineId: exit.lineId,
        itemId: ItemRef.of(exit.itemId),
        warehouseId: WarehouseRef.of(exit.warehouseId),
        direction: 'out' as const,
        quantity: Quantity.of(exit.quantity),
        unitCost: null,
      })),
      now,
    );

    await writeChanges(tx, tenantId, changes);
  }

  async lockAvailable(tx: TransactionClient, tenantId: string, keys: [itemId: string, warehouseId: string][]): Promise<Map<string, number>> {
    const available = new Map<string, number>();
    const ledger = await lockedLedger(tx, tenantId, keys, []);

    for (const [itemId, warehouseId] of keys) {
      available.set(`${itemId}|${warehouseId}`, ledger.stock(ItemRef.of(itemId), WarehouseRef.of(warehouseId)).available().toNumber());
    }

    return available;
  }

  async reverse(tx: TransactionClient, tenantId: string, document: StockDocument, now: Date): Promise<void> {
    const previous = await movementsOf(tx, tenantId, document.type, document.id);
    const ledger = await lockedLedger(
      tx,
      tenantId,
      previous.map((movement) => [movement.itemId.value, movement.warehouseId.value]),
      previous,
    );

    await writeChanges(tx, tenantId, this.movements.reverse(ledger, document, now));
  }

  async restore(tx: TransactionClient, tenantId: string, document: StockDocument, restores: DocumentStockRestore[], now: Date): Promise<Map<string, string>> {
    const originalIds = [...new Set(restores.map((r) => r.originalMovementId))];
    const originalRows = await tx.inventoryMovement.findMany({
      where: { tenantId, id: { in: originalIds } },
    });
    const originalsMap = new Map(originalRows.map((row) => [row.id, movementFromRow(row)]));

    const ledger = await lockedLedger(
      tx,
      tenantId,
      restores.map((restore) => [restore.itemId, restore.warehouseId]),
      [],
    );

    const changes = this.movements.restore(
      ledger,
      document,
      restores.map((restore) => {
        const originalMovement = originalsMap.get(restore.originalMovementId);
        if (!originalMovement) {
          throw new Error(`Original inventory movement <${restore.originalMovementId}> not found.`);
        }
        return {
          lineId: restore.lineId,
          originalMovement,
          quantity: Quantity.of(restore.quantity),
        };
      }),
      now,
    );

    await writeChanges(tx, tenantId, changes);

    const lineToMovement = new Map<string, string>();
    for (const movement of changes.movements) {
      if (movement.origin.lineId) {
        lineToMovement.set(movement.origin.lineId, movement.id.value);
      }
    }

    return lineToMovement;
  }

  async movementsOf(tx: TransactionClient, tenantId: string, type: 'receipt' | 'dispatch', originId: string): Promise<DocumentStockMovement[]> {
    const movements = await movementsOf(tx, tenantId, type, originId);
    return movements.map((m) => ({
      id: m.id.value,
      lineId: m.origin.lineId,
      itemId: m.itemId.value,
      warehouseId: m.warehouseId.value,
      unitCost: m.unitCost.toNumber(),
      quantity: m.quantity.toNumber(),
    }));
  }
}
