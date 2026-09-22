import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_STOCK_POSTING } from '../../../../shared/prisma/document-stock-posting.js';
import type { DocumentStockPosting } from '../../../../shared/prisma/document-stock-posting.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  InactivePurchaseItemError,
  PurchaseReturnAlreadyCancelledError,
  PurchaseReturnNotConfirmableError,
  PurchaseReturnNotFoundError,
  PurchaseReturnSupplierMismatchError,
  QuantityExceedsReceiptReturnQuotaError,
  ReceiptLineNotFoundError,
  ReceiptNotReturnableError,
  ReceivedGoodsAlreadyUsedError,
  ReturnBeforeReceiptError,
  ServiceNotPurchasableError,
} from '../../domain/errors/purchasing.errors.js';
import { PurchaseReturnPosting } from '../../domain/return/posting/purchase-return-posting.js';
import { PurchaseReturn, PurchaseReturnId } from '../../domain/return/purchase-return.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PURCHASE_RETURN_INCLUDE, purchaseReturnFromRow } from './purchasing-rows.js';

const day = (value: Date) => value.toISOString().slice(0, 10);

@Injectable()
export class PrismaPurchaseReturnPosting implements PurchaseReturnPosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_STOCK_POSTING) private readonly stock: DocumentStockPosting,
  ) {}

  async confirm(tenantId: TenantId, returnId: PurchaseReturnId, now: Date): Promise<PurchaseReturn> {
    const tenant = tenantId.value;

    return this.prisma.$transaction(async (tx) => {
      const lockedReturns = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM purchase_returns
        WHERE tenant_id = ${tenant}::uuid AND id = ${returnId.value}::uuid
        FOR UPDATE`;

      if (lockedReturns.length === 0) {
        throw new PurchaseReturnNotFoundError(returnId.value);
      }

      const returnRow = await tx.purchaseReturn.findFirstOrThrow({
        where: { tenantId: tenant, id: returnId.value },
        include: PURCHASE_RETURN_INCLUDE,
      });

      const returnDoc = purchaseReturnFromRow(returnRow);
      if (returnDoc.currentStatus() !== 'draft') {
        throw new PurchaseReturnNotConfirmableError(returnDoc.id.value, returnDoc.currentStatus());
      }

      // Bloquear la recepcion de mercancia citada
      const lockedReceipts = await tx.$queryRaw<{ id: string; order_id: string; receipt_date: Date; status: string }[]>`
        SELECT id, order_id, receipt_date, status FROM goods_receipts
        WHERE tenant_id = ${tenant}::uuid AND id = ${returnDoc.receiptId.value}::uuid
        FOR UPDATE`;

      if (lockedReceipts.length === 0) {
        throw new ReceiptNotReturnableError(returnDoc.receiptId.value, 'none');
      }

      const receiptRow = lockedReceipts[0];
      if (receiptRow.status !== 'confirmed') {
        throw new ReceiptNotReturnableError(receiptRow.id, receiptRow.status);
      }

      // Validar que la orden pertenezca al proveedor de la devolucion
      const orderRow = await tx.purchaseOrder.findFirstOrThrow({
        where: { tenantId: tenant, id: receiptRow.order_id },
        select: { supplierId: true },
      });

      if (orderRow.supplierId !== returnDoc.supplierId.value) {
        throw new PurchaseReturnSupplierMismatchError(receiptRow.id, returnDoc.supplierId.value);
      }

      if (returnDoc.returnDate().value < day(receiptRow.receipt_date)) {
        throw new ReturnBeforeReceiptError(receiptRow.id, returnDoc.returnDate().value, day(receiptRow.receipt_date));
      }

      // Control de cupos en caliente contra devoluciones confirmadas de la recepcion
      const existingLines = await tx.purchaseReturnLine.findMany({
        where: {
          tenantId: tenant,
          purchaseReturn: {
            tenantId: tenant,
            receiptId: returnDoc.receiptId.value,
            status: 'confirmed',
            id: { not: returnDoc.id.value },
          },
        },
        select: { receiptLineId: true, quantity: true },
      });

      const alreadyReturned = new Map<string, number>();
      for (const row of existingLines) {
        alreadyReturned.set(row.receiptLineId, (alreadyReturned.get(row.receiptLineId) ?? 0) + Number(row.quantity));
      }

      const receiptLines = await tx.goodsReceiptLine.findMany({
        where: { tenantId: tenant, receiptId: returnDoc.receiptId.value },
      });

      const receiptMovements = await this.stock.movementsOf(tx, tenant, 'receipt', returnDoc.receiptId.value);

      const restores: Array<{
        lineId: string;
        itemId: string;
        warehouseId: string;
        quantity: number;
        originalMovementId: string;
      }> = [];

      for (const line of returnDoc.lines()) {
        const receiptLine = receiptLines.find((rl) => rl.id === line.receiptLineId);
        if (!receiptLine) {
          throw new ReceiptLineNotFoundError(line.receiptLineId);
        }

        const returnedSoFar = alreadyReturned.get(line.receiptLineId) ?? 0;
        const availableQuota = Number(receiptLine.quantity) - returnedSoFar;

        if (line.quantity.toNumber() > availableQuota + 1e-6) {
          throw new QuantityExceedsReceiptReturnQuotaError(
            line.receiptLineId,
            availableQuota,
            line.quantity.toNumber(),
          );
        }

        const originalMovement = receiptMovements.find((m) => m.lineId === line.receiptLineId);
        if (!originalMovement) {
          throw new ReceivedGoodsAlreadyUsedError(returnDoc.receiptId.value);
        }

        restores.push({
          lineId: line.id.value,
          itemId: line.itemId.value,
          warehouseId: returnDoc.warehouseId.value,
          quantity: line.baseQuantity.toNumber(),
          originalMovementId: originalMovement.id,
        });
      }

      // Restituir existencia: sale al costo congelado de la entrada de compra,
      // actualiza el costo promedio ponderado de lo que queda en la bodega y el maestro.
      // La orden de compra NO se toca (§3.11).
      let restoreMap: Map<string, string>;
      try {
        restoreMap = await this.stock.restore(
          tx,
          tenant,
          {
            type: 'purchase_return',
            id: returnDoc.id.value,
            date: returnDoc.returnDate().value,
          },
          restores,
          now,
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'InsufficientStockError') {
          throw new ReceivedGoodsAlreadyUsedError(returnDoc.receiptId.value);
        }
        if (error instanceof Error && error.name === 'InactiveStockItemError') {
          throw new InactivePurchaseItemError(itemOf(error));
        }
        if (error instanceof Error && error.name === 'ServiceHasNoStockError') {
          throw new ServiceNotPurchasableError(itemOf(error));
        }
        throw error;
      }

      returnDoc.confirm(now, restoreMap);

      await tx.purchaseReturn.update({
        where: { tenantId_id: { tenantId: tenant, id: returnDoc.id.value } },
        data: {
          status: 'confirmed',
          confirmedAt: now,
          updatedAt: now,
        },
      });

      for (const line of returnDoc.lines()) {
        if (line.restoresMovementId) {
          await tx.purchaseReturnLine.updateMany({
            where: { tenantId: tenant, id: line.id.value },
            data: { restoresMovementId: line.restoresMovementId },
          });
        }
      }

      return returnDoc;
    });
  }

  async cancel(tenantId: TenantId, returnId: PurchaseReturnId, now: Date): Promise<PurchaseReturn> {
    const tenant = tenantId.value;

    return this.prisma.$transaction(async (tx) => {
      const lockedReturns = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM purchase_returns
        WHERE tenant_id = ${tenant}::uuid AND id = ${returnId.value}::uuid
        FOR UPDATE`;

      if (lockedReturns.length === 0) {
        throw new PurchaseReturnNotFoundError(returnId.value);
      }

      const returnRow = await tx.purchaseReturn.findFirstOrThrow({
        where: { tenantId: tenant, id: returnId.value },
        include: PURCHASE_RETURN_INCLUDE,
      });

      const returnDoc = purchaseReturnFromRow(returnRow);
      if (returnDoc.currentStatus() === 'cancelled') {
        throw new PurchaseReturnAlreadyCancelledError(returnDoc.id.value);
      }

      const wasConfirmed = returnDoc.currentStatus() === 'confirmed';

      // Si estaba confirmada, revertir la salida de mercancia en el inventario
      if (wasConfirmed) {
        await this.stock.reverse(
          tx,
          tenant,
          {
            type: 'purchase_return',
            id: returnDoc.id.value,
            date: returnDoc.returnDate().value,
          },
          now,
        );
      }

      returnDoc.cancel(now);

      await tx.purchaseReturn.update({
        where: { tenantId_id: { tenantId: tenant, id: returnDoc.id.value } },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now,
        },
      });

      return returnDoc;
    });
  }
}

const itemOf = (error: Error) => String((error as Error & { itemId?: string }).itemId);
