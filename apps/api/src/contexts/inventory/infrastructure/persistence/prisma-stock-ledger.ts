import type { TransactionClient } from '../../../../shared/prisma/document-stock-posting.js';
import { InventoryMovement, MovementOriginType } from '../../domain/movement/inventory-movement.entity.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { ItemStock } from '../../domain/stock/item-stock.entity.js';
import { Ledger, StockChanges } from '../../domain/stock/posting/stock-ledger.js';
import { movementFromRow, stockFromRow } from './inventory-rows.js';

const keyOf = (itemId: string, warehouseId: string) => `${itemId}|${warehouseId}`;

// Lo que comparten todas las publicaciones que mueven existencia, dentro de la transaccion
// de quien las llama. Quien llama bloquea antes su documento; aqui se bloquean las
// existencias, siempre despues y siempre en el mismo orden, para que dos documentos con los
// mismos articulos esperen en fila en vez de bloquearse mutuamente.

export async function movementsOf(tx: TransactionClient, tenantId: string, type: MovementOriginType, originId: string): Promise<InventoryMovement[]> {
  const rows = await tx.inventoryMovement.findMany({
    where: { tenantId, originType: type, originId },
    orderBy: { sequence: 'asc' },
  });

  return rows.map(movementFromRow);
}

// Crea las existencias que falten y las bloquea. Si el trabajo que sigue lanza, la
// transaccion revierte tambien las filas creadas.
export async function lockedLedger(
  tx: TransactionClient,
  tenantId: string,
  keys: [itemId: string, warehouseId: string][],
  previous: InventoryMovement[],
): Promise<Ledger> {
  const unique = [...new Map(keys.map(([item, warehouse]) => [keyOf(item, warehouse), [item, warehouse] as const])).values()].sort(
    ([a, b], [c, d]) => a.localeCompare(c) || b.localeCompare(d),
  );
  const stocks = new Map<string, ItemStock>();

  for (const [itemId, warehouseId] of unique) {
    await tx.$executeRaw`
      INSERT INTO item_stocks (tenant_id, item_id, warehouse_id, quantity, average_cost, last_sequence, updated_at)
      VALUES (${tenantId}::uuid, ${itemId}::uuid, ${warehouseId}::uuid, 0, 0, 0, now())
      ON CONFLICT (tenant_id, item_id, warehouse_id) DO NOTHING`;
    await tx.$queryRaw`
      SELECT 1 FROM item_stocks
      WHERE tenant_id = ${tenantId}::uuid AND item_id = ${itemId}::uuid AND warehouse_id = ${warehouseId}::uuid
      FOR UPDATE`;

    const row = await tx.itemStock.findUniqueOrThrow({
      where: { tenantId_itemId_warehouseId: { tenantId, itemId, warehouseId } },
    });

    stocks.set(keyOf(itemId, warehouseId), stockFromRow(row));
  }

  return {
    stock: (itemId: ItemRef, warehouseId: WarehouseRef) => {
      const stock = stocks.get(keyOf(itemId.value, warehouseId.value));

      // No deberia pasar: se bloquearon todas las que el documento puede tocar.
      if (!stock) throw new Error(`Stock <${itemId.value}> in <${warehouseId.value}> was not locked.`);

      return stock;
    },
    movementsOf: () => previous,
  };
}

export async function writeChanges(tx: TransactionClient, tenantId: string, changes: StockChanges): Promise<void> {
  await tx.inventoryMovement.createMany({ data: changes.movements.map((movement) => movement.toPrimitives()) });

  for (const stock of changes.stocks) {
    const { quantity, averageCost, lastSequence, updatedAt, itemId, warehouseId } = stock.toPrimitives();

    await tx.itemStock.update({
      where: { tenantId_itemId_warehouseId: { tenantId, itemId, warehouseId } },
      data: { quantity, averageCost, lastSequence, updatedAt },
    });
  }
}
