import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AdjustmentId } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentPosting, Ledger, Posting } from '../../domain/adjustment/posting/adjustment-posting.js';
import { Adjustment } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentNotFoundError } from '../../domain/errors/inventory.errors.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ItemStock } from '../../domain/stock/item-stock.entity.js';
import { adjustmentFromRow, movementFromRow, stockFromRow } from './inventory-rows.js';

const keyOf = (itemId: string, warehouseId: string) => `${itemId}|${warehouseId}`;

// El unico sitio que escribe existencias y kardex. Todo ocurre en una transaccion:
//
// 1. Bloquea la fila del ajuste. Dos confirmaciones del mismo ajuste esperan en fila, y la
//    segunda lo lee ya confirmado.
// 2. Crea las existencias que falten y las bloquea en un orden fijo. Dos ajustes que
//    sacan el mismo articulo esperan en fila y el segundo ve el saldo que dejo el primero;
//    el orden fijo evita que dos ajustes con los mismos articulos se bloqueen mutuamente.
// 3. Ejecuta el trabajo del dominio. Si lanza, se revierte todo, tambien las filas creadas.
// 4. Escribe ajuste, movimientos y existencias.
@Injectable()
export class PrismaAdjustmentPosting implements AdjustmentPosting {
  constructor(private readonly prisma: PrismaService) {}

  async post(
    tenantId: TenantId,
    adjustmentId: AdjustmentId,
    work: (adjustment: Adjustment, ledger: Ledger) => Posting,
  ): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM adjustments WHERE tenant_id = ${tenant}::uuid AND id = ${adjustmentId.value}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new AdjustmentNotFoundError(adjustmentId.value);

      const adjustment = adjustmentFromRow(
        await tx.adjustment.findFirstOrThrow({ where: { tenantId: tenant, id: adjustmentId.value }, include: { lines: true } }),
      );
      const previous = (
        await tx.inventoryMovement.findMany({
          where: { tenantId: tenant, originType: 'adjustment', originId: adjustmentId.value },
          orderBy: { sequence: 'asc' },
        })
      ).map(movementFromRow);

      const warehouseId = adjustment.warehouseId().value;
      const keys = [
        ...adjustment.lines().map((line) => [line.itemId.value, warehouseId]),
        ...previous.map((movement) => [movement.itemId.value, movement.warehouseId.value]),
      ];
      const unique = [...new Map(keys.map(([item, warehouse]) => [keyOf(item, warehouse), [item, warehouse]])).values()].sort(
        ([a, b], [c, d]) => a.localeCompare(c) || b.localeCompare(d),
      );

      const stocks = new Map<string, ItemStock>();

      for (const [itemId, stockWarehouseId] of unique) {
        await tx.$executeRaw`
          INSERT INTO item_stocks (tenant_id, item_id, warehouse_id, quantity, average_cost, last_sequence, updated_at)
          VALUES (${tenant}::uuid, ${itemId}::uuid, ${stockWarehouseId}::uuid, 0, 0, 0, now())
          ON CONFLICT (tenant_id, item_id, warehouse_id) DO NOTHING`;
        await tx.$queryRaw`
          SELECT 1 FROM item_stocks
          WHERE tenant_id = ${tenant}::uuid AND item_id = ${itemId}::uuid AND warehouse_id = ${stockWarehouseId}::uuid
          FOR UPDATE`;

        const row = await tx.itemStock.findUniqueOrThrow({
          where: { tenantId_itemId_warehouseId: { tenantId: tenant, itemId, warehouseId: stockWarehouseId } },
        });

        stocks.set(keyOf(itemId, stockWarehouseId), stockFromRow(row));
      }

      const ledger: Ledger = {
        stock: (itemId: ItemRef, stockWarehouse: WarehouseRef) => {
          const stock = stocks.get(keyOf(itemId.value, stockWarehouse.value));

          // No deberia pasar: se bloquearon todas las que el ajuste puede tocar.
          if (!stock) throw new Error(`Stock <${itemId.value}> in <${stockWarehouse.value}> was not locked.`);

          return stock;
        },
        movementsOf: () => previous,
      };

      const posting = work(adjustment, ledger);
      const { lines: _lines, adjustmentDate: _date, ...header } = posting.adjustment.toPrimitives();

      await tx.adjustment.update({
        where: { tenantId_id: { tenantId: tenant, id: header.id } },
        data: {
          status: header.status,
          confirmedAt: header.confirmedAt,
          cancelledAt: header.cancelledAt,
          updatedAt: header.updatedAt,
        },
      });

      await tx.inventoryMovement.createMany({ data: posting.movements.map((movement) => movement.toPrimitives()) });

      for (const stock of posting.stocks) {
        const { quantity, averageCost, lastSequence, updatedAt, itemId, warehouseId: stockWarehouseId } = stock.toPrimitives();

        await tx.itemStock.update({
          where: { tenantId_itemId_warehouseId: { tenantId: tenant, itemId, warehouseId: stockWarehouseId } },
          data: { quantity, averageCost, lastSequence, updatedAt },
        });
      }
    });
  }
}
