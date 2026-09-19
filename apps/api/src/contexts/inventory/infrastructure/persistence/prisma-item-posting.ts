import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ItemNotFoundError } from '../../domain/errors/item.errors.js';
import { ItemCommitments } from '../../domain/item/commitments/item-commitments.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { Item } from '../../domain/item/item.entity.js';
import { ItemPosting } from '../../domain/item/posting/item-posting.js';
import { UnitRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { itemFromRow, writeItem } from './prisma-item.repository.js';

// Todo en una transaccion. Bloquea la fila del articulo antes de leer lo que comprometio: quien
// mueve su existencia o confirma un documento con el la bloquea en modo compartido, asi que el
// cambio y el documento van en fila y el segundo ve lo que dejo el primero. Lee tablas de
// compras y ventas sin importar esos contextos.
@Injectable()
export class PrismaItemPosting implements ItemPosting {
  constructor(private readonly prisma: PrismaService) {}

  async post(tenantId: TenantId, itemId: ItemId, work: (item: Item, commitments: ItemCommitments) => void): Promise<void> {
    const tenant = tenantId.value;
    const id = itemId.value;

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM items WHERE tenant_id = ${tenant}::uuid AND id = ${id}::uuid FOR UPDATE`;

      if (locked.length === 0) throw new ItemNotFoundError(id);

      const item = itemFromRow(await tx.item.findFirstOrThrow({ where: { tenantId: tenant, id }, include: { units: true, reorderRules: true, prices: true } }));
      const stock = await tx.itemStock.findFirst({ where: { tenantId: tenant, itemId: id, quantity: { gt: 0 } }, select: { itemId: true } });
      const movement = await tx.inventoryMovement.findFirst({ where: { tenantId: tenant, itemId: id }, select: { id: true } });
      const openLines = await tx.$queryRaw<{ unit_id: string; origin: string }[]>`
        SELECT unit_id, origin FROM (
          SELECT l.unit_id::text AS unit_id, 'purchase' AS origin
          FROM purchase_order_lines l
          JOIN purchase_orders o ON o.tenant_id = l.tenant_id AND o.id = l.order_id
          WHERE l.tenant_id = ${tenant}::uuid AND l.item_id = ${id}::uuid
            AND o.status IN ('confirmed', 'partially_received') AND l.quantity > l.received_quantity
          UNION
          SELECT l.unit_id::text, 'sales'
          FROM sales_order_lines l
          JOIN sales_orders o ON o.tenant_id = l.tenant_id AND o.id = l.order_id
          WHERE l.tenant_id = ${tenant}::uuid AND l.item_id = ${id}::uuid
            AND o.status IN ('confirmed', 'partially_dispatched') AND l.quantity > l.dispatched_quantity
        ) AS open_lines
        ORDER BY unit_id COLLATE "C"`;

      work(item, {
        hasStock: stock !== null,
        hasMovements: movement !== null,
        // La misma unidad puede venir de los dos lados: al articulo solo le importa una vez.
        openDocumentUnits: [...new Set(openLines.map((row) => row.unit_id))].map((unitId) => UnitRef.of(unitId)),
        openPurchaseOrders: openLines.some((row) => row.origin === 'purchase'),
        openSalesOrders: openLines.some((row) => row.origin === 'sales'),
      });

      await writeItem(tx, item);
    });
  }
}
