import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_STOCK_POSTING } from '../../../../shared/prisma/document-stock-posting.js';
import type { DocumentStockPosting } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { Dispatch, DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchPosting, DispatchPostingResult } from '../../domain/dispatch/posting/dispatch-posting.js';
import { InactiveSalesItemError, InsufficientStockForDispatchError, ServiceNotSellableError } from '../../domain/errors/sales.errors.js';
import { SalesOrder } from '../../domain/order/sales-order.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { lockDispatch, lockOrder, writeDispatchState, writeOrderState } from './prisma-sales-writer.js';

// Todo en una transaccion y en el mismo orden de bloqueo que compras: el despacho, su pedido y,
// dentro del inventario, las existencias.
@Injectable()
export class PrismaDispatchPosting implements DispatchPosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_STOCK_POSTING) private readonly stock: DocumentStockPosting,
  ) {}

  async post(
    tenantId: TenantId,
    dispatchId: DispatchId,
    work: (dispatch: Dispatch, order: SalesOrder, invoiced: boolean) => DispatchPostingResult,
  ): Promise<void> {
    const tenant = tenantId.value;

    await this.prisma.$transaction(async (tx) => {
      const { dispatch, invoiced } = await lockDispatch(tx, tenant, dispatchId.value);
      const order = await lockOrder(tx, tenant, dispatch.orderId.value);

      const result = work(dispatch, order, invoiced);
      const now = result.dispatch.toPrimitives().updatedAt;
      const document = { type: 'dispatch' as const, id: dispatch.id.value, date: result.dispatch.toPrimitives().dispatchDate };

      await writeDispatchState(tx, result.dispatch);
      await writeOrderState(tx, result.order);

      try {
        if (result.stock.kind === 'release') {
          await this.stock.release(
            tx,
            tenant,
            document,
            result.stock.exits.map((exit) => ({
              lineId: exit.lineId,
              itemId: exit.itemId.value,
              warehouseId: exit.warehouseId.value,
              quantity: exit.quantity.toNumber(),
            })),
            now,
          );
        } else if (result.stock.kind === 'reverse') {
          await this.stock.reverse(tx, tenant, document, now);
        }
      } catch (error) {
        // Capa anticorrupcion: revertir la salida de un despacho solo devuelve existencia y no
        // puede quedarse corto; sacarla si, cuando alguien se llevo lo reservado.
        if (error instanceof Error && error.name === 'InsufficientStockError') {
          throw new InsufficientStockForDispatchError(dispatch.id.value);
        }

        // El articulo se desactivo o se volvio servicio: anular el despacho le devolveria mercancia.
        if (error instanceof Error && error.name === 'InactiveStockItemError') {
          throw new InactiveSalesItemError(itemOf(error));
        }

        if (error instanceof Error && error.name === 'ServiceHasNoStockError') {
          throw new ServiceNotSellableError(itemOf(error));
        }

        throw error;
      }
    });
  }
}

const itemOf = (error: Error) => String((error as Error & { itemId?: string }).itemId);
