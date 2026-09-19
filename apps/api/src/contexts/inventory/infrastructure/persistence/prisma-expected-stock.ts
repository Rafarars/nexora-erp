import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { ExpectedQuantity, ExpectedStock } from '../../domain/stock/expected-stock.js';
import { WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Capa anticorrupcion del aviso de reposicion: lo reservado sale de los pedidos de venta y lo
// que viene en camino, de las ordenes de compra, sin importar nada de esos contextos. El
// pendiente de cada linea se lleva a unidad base en la misma proporcion que usan sus dominios.
@Injectable()
export class PrismaExpectedStock implements ExpectedStock {
  constructor(private readonly prisma: PrismaService) {}

  async pending(tenantId: TenantId, warehouseId?: WarehouseRef): Promise<ExpectedQuantity[]> {
    const tenant = tenantId.value;
    const warehouse = warehouseId?.value ?? null;

    const rows = await this.prisma.$queryRaw<{ item_id: string; warehouse_id: string; reserved: Prisma.Decimal; incoming: Prisma.Decimal }[]>`
      SELECT item_id, warehouse_id, SUM(reserved) AS reserved, SUM(incoming) AS incoming
      FROM (
        SELECT l.item_id::text AS item_id, o.warehouse_id::text AS warehouse_id,
               ROUND(l.base_quantity * (l.quantity - l.dispatched_quantity) / l.quantity, 4) AS reserved,
               0 AS incoming
        FROM sales_order_lines l
        JOIN sales_orders o ON o.tenant_id = l.tenant_id AND o.id = l.order_id
        WHERE l.tenant_id = ${tenant}::uuid AND l.moves_stock
          AND o.status IN ('confirmed', 'partially_dispatched') AND l.quantity > l.dispatched_quantity
          AND (${warehouse}::uuid IS NULL OR o.warehouse_id = ${warehouse}::uuid)
        UNION ALL
        SELECT l.item_id::text, o.warehouse_id::text,
               0,
               ROUND(l.base_quantity * (l.quantity - l.received_quantity) / l.quantity, 4)
        FROM purchase_order_lines l
        JOIN purchase_orders o ON o.tenant_id = l.tenant_id AND o.id = l.order_id
        WHERE l.tenant_id = ${tenant}::uuid AND l.moves_stock
          AND o.status IN ('confirmed', 'partially_received') AND l.quantity > l.received_quantity
          AND (${warehouse}::uuid IS NULL OR o.warehouse_id = ${warehouse}::uuid)
      ) AS pending_lines
      GROUP BY item_id, warehouse_id`;

    return rows.map((row) => ({
      itemId: row.item_id,
      warehouseId: row.warehouse_id,
      reserved: Number(row.reserved),
      incoming: Number(row.incoming),
    }));
  }
}
