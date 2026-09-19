import { Inject, Injectable } from '@nestjs/common';
import { lockItems } from '../../../../shared/prisma/inventory-items.js';
import { DOCUMENT_STOCK_POSTING } from '../../../../shared/prisma/document-stock-posting.js';
import type { DocumentStockPosting } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { SalesOrderPosting } from '../../domain/order/posting/sales-order-posting.js';
import { StockAvailability } from '../../domain/order/posting/stock-availability.js';
import { SalesOrder, SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { Quantity } from '../../domain/shared/quantity.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { lockOrder, writeOrderState } from './prisma-sales-writer.js';

// En una transaccion: bloquea el pedido, luego sus articulos en modo compartido (un cambio del
// articulo espera a la reserva), luego las filas de existencia en su bodega (por el contrato del
// inventario) y solo entonces suma lo que reservan los demas pedidos.
// Dos pedidos del mismo articulo bloquean la misma fila: el segundo espera y ve la reserva del
// primero. Un pedido de un articulo sin fila de existencia la crea en cero y tambien la bloquea.
@Injectable()
export class PrismaSalesOrderPosting implements SalesOrderPosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_STOCK_POSTING) private readonly stock: DocumentStockPosting,
  ) {}

  async post(tenantId: TenantId, orderId: SalesOrderId, work: (order: SalesOrder, availability: StockAvailability) => void): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, tenant, orderId.value);
      const warehouseId = order.warehouseId().value;
      const itemIds = [...order.reservedByItem().keys()];
      const items = await lockItems(tx, tenant, order.lines().map((line) => line.itemId.value));
      const onHand = await this.stock.lockAvailable(tx, tenant, itemIds.map((itemId) => [itemId, warehouseId]));

      const reserved = await tx.$queryRaw<{ item_id: string; units: string }[]>`
        SELECT l.item_id,
               SUM(ROUND(l.base_quantity * (l.quantity - l.dispatched_quantity) / l.quantity, 4) * 10000)::bigint::text AS units
        FROM sales_order_lines l
        JOIN sales_orders o ON o.tenant_id = l.tenant_id AND o.id = l.order_id
        WHERE o.tenant_id = ${tenant}::uuid
          AND o.warehouse_id = ${warehouseId}::uuid
          AND o.id <> ${order.id.value}::uuid
          -- Un servicio no sale de la bodega: no reserva nada. El dominio y la pantalla ya lo
          -- filtraban; aqui faltaba, y este es el sitio que decide.
          AND l.moves_stock
          AND o.status IN ('confirmed', 'partially_dispatched')
          AND l.item_id = ANY(${itemIds}::uuid[])
        GROUP BY l.item_id`;

      // Se redondea CADA linea a diezmilesimas y despues se suman, que es lo que hace el dominio
      // (`SalesOrderLine.pendingBase`). Sumar primero y redondear al final da otra cifra, y el
      // entero evita que la coma flotante meta la suya en el sitio que decide la reserva.
      const reservedOf = (itemId: string) => {
        const row = reserved.find((candidate) => candidate.item_id === itemId);

        return row ? Quantity.fromUnits(BigInt(row.units)) : Quantity.zero();
      };

      work(order, {
        onHand: (itemId) => Quantity.of(Math.max(0, onHand.get(`${itemId.value}|${warehouseId}`) ?? 0)),
        reservedByOthers: (itemId) => reservedOf(itemId.value),
        item: (itemId) => {
          const item = items.get(itemId.value);

          return item ? { isActive: item.isActive, type: item.type, factorOf: (unitId) => item.factorOf(unitId.value) } : null;
        },
      });

      await writeOrderState(tx, order);
    });
  }
}
