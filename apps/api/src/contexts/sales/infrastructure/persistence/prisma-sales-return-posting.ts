import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_STOCK_POSTING } from '../../../../shared/prisma/document-stock-posting.js';
import type { DocumentStockPosting } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  DispatchLineNotFoundError,
  DispatchNotReturnableError,
  InactiveSalesItemError,
  QuantityExceedsDispatchedReturnQuotaError,
  ReturnBeforeDispatchError,
  ReturnCustomerMismatchError,
  SalesReturnAlreadyCancelledError,
  SalesReturnNotConfirmableError,
  SalesReturnWithCreditNoteError,
  ServiceNotSellableError,
} from '../../domain/errors/sales.errors.js';
import { SALES_RETURN_CREDITED_CHECKER } from '../../domain/return/credited/sales-return-credited-checker.js';
import type { SalesReturnCreditedChecker } from '../../domain/return/credited/sales-return-credited-checker.js';
import { SalesReturnPosting } from '../../domain/return/posting/sales-return-posting.js';
import { SalesReturn, SalesReturnId } from '../../domain/return/sales-return.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { lockDispatch, lockSalesReturn, writeSalesReturnState } from './prisma-sales-writer.js';

@Injectable()
export class PrismaSalesReturnPosting implements SalesReturnPosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_STOCK_POSTING) private readonly stock: DocumentStockPosting,
    @Inject(SALES_RETURN_CREDITED_CHECKER) private readonly creditedChecker: SalesReturnCreditedChecker,
  ) {}

  async confirm(tenantId: TenantId, returnId: SalesReturnId, now: Date): Promise<SalesReturn> {
    const tenant = tenantId.value;

    return this.prisma.$transaction(async (tx) => {
      const returnEntity = await lockSalesReturn(tx, tenant, returnId.value);
      if (returnEntity.currentStatus() !== 'draft') {
        throw new SalesReturnNotConfirmableError(returnEntity.id.value, returnEntity.currentStatus());
      }

      const linesWithValuation: { lineId: string; unitCost: number; restoresMovementId: string }[] = [];

      if (returnEntity.dispatchId) {
        const { dispatch } = await lockDispatch(tx, tenant, returnEntity.dispatchId.value);
        if (dispatch.currentStatus() !== 'confirmed') {
          throw new DispatchNotReturnableError(dispatch.id.value, dispatch.currentStatus());
        }

        const orderRow = await tx.salesOrder.findFirstOrThrow({
          where: { tenantId: tenant, id: dispatch.orderId.value },
          select: { customerId: true },
        });

        if (orderRow.customerId !== returnEntity.customerId.value) {
          throw new ReturnCustomerMismatchError(returnEntity.customerId.value, orderRow.customerId);
        }

        if (returnEntity.date().isBefore(dispatch.date())) {
          throw new ReturnBeforeDispatchError(returnEntity.date().value, dispatch.date().value);
        }

        // Consultar devoluciones ya confirmadas de este despacho para verificar cupos atómicamente
        const existingLines = await tx.salesReturnLine.findMany({
          where: {
            tenantId: tenant,
            dispatchLineId: { not: null },
            salesReturn: {
              tenantId: tenant,
              dispatchId: dispatch.id.value,
              status: 'confirmed',
              id: { not: returnEntity.id.value },
            },
          },
          select: { dispatchLineId: true, quantity: true },
        });

        const alreadyReturned = new Map<string, number>();
        for (const row of existingLines) {
          if (row.dispatchLineId) {
            alreadyReturned.set(row.dispatchLineId, (alreadyReturned.get(row.dispatchLineId) ?? 0) + Number(row.quantity));
          }
        }

        // Obtener movimientos de kardex del despacho de origen
        const dispatchMovements = await this.stock.movementsOf(tx, tenant, 'dispatch', dispatch.id.value);

        for (const line of returnEntity.lines()) {
          if (!line.dispatchLineId) continue;

          const dispatchLine = dispatch.lines().find((dl) => dl.id.value === line.dispatchLineId);
          if (!dispatchLine) {
            throw new DispatchLineNotFoundError(line.dispatchLineId);
          }

          const returnedSoFar = alreadyReturned.get(line.dispatchLineId) ?? 0;
          const availableQuota = dispatchLine.quantity.toNumber() - returnedSoFar;

          if (line.quantity.toNumber() > availableQuota) {
            throw new QuantityExceedsDispatchedReturnQuotaError(
              line.dispatchLineId,
              availableQuota,
              line.quantity.toNumber(),
            );
          }

          // Encontrar el movimiento de salida del despacho
          const movement = dispatchMovements.find((m) => m.lineId === line.dispatchLineId);
          if (movement) {
            linesWithValuation.push({
              lineId: line.id.value,
              unitCost: movement.unitCost,
              restoresMovementId: movement.id,
            });
          }
        }
      }

      returnEntity.confirm(linesWithValuation, now);
      await writeSalesReturnState(tx, returnEntity);

      // Reingreso al kardex: solo si no es scrap (§3.5)
      if (returnEntity.condition() !== 'scrap') {
        const linesToRestore = returnEntity.lines().filter((l) => l.restoresMovementId !== null);
        if (linesToRestore.length > 0) {
          try {
            await this.stock.restore(
              tx,
              tenant,
              {
                type: 'sales_return',
                id: returnEntity.id.value,
                date: returnEntity.date().value,
              },
              linesToRestore.map((l) => ({
                lineId: l.id.value,
                itemId: l.itemId.value,
                warehouseId: returnEntity.warehouseId.value,
                originalMovementId: l.restoresMovementId!,
                quantity: l.baseQuantity.toNumber(),
              })),
              now,
            );
          } catch (error) {

            if (error instanceof Error && error.name === 'InactiveStockItemError') {
              throw new InactiveSalesItemError(itemOf(error));
            }
            if (error instanceof Error && error.name === 'ServiceHasNoStockError') {
              throw new ServiceNotSellableError(itemOf(error));
            }
            throw error;
          }
        }
      }

      return returnEntity;
    });
  }

  async cancel(tenantId: TenantId, returnId: SalesReturnId, now: Date): Promise<SalesReturn> {
    const tenant = tenantId.value;

    return this.prisma.$transaction(async (tx) => {
      const returnEntity = await lockSalesReturn(tx, tenant, returnId.value);
      if (returnEntity.currentStatus() === 'cancelled') {
        throw new SalesReturnAlreadyCancelledError(returnEntity.id.value);
      }

      // Una devolucion acreditada por una nota de credito confirmada no se anula (§4.1)
      const isCredited = await this.creditedChecker.isCredited(tenantId, returnId);
      if (isCredited) {
        throw new SalesReturnWithCreditNoteError(returnEntity.id.value);
      }

      const wasConfirmed = returnEntity.currentStatus() === 'confirmed';

      // Si estaba confirmada y reingreso mercancia, revertir su movimiento en el kardex
      if (wasConfirmed && returnEntity.condition() !== 'scrap') {
        await this.stock.reverse(
          tx,
          tenant,
          {
            type: 'sales_return',
            id: returnEntity.id.value,
            date: returnEntity.date().value,
          },
          now,
        );
      }

      returnEntity.cancel(now);
      await writeSalesReturnState(tx, returnEntity);

      return returnEntity;
    });
  }
}

const itemOf = (error: Error) => String((error as Error & { itemId?: string }).itemId);
