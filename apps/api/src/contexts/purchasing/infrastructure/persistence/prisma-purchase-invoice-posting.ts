import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import {
  DuplicateSupplierInvoiceNumberError,
  InvoiceItemMismatchError,
  InvoiceLinesFromDifferentSupplierError,
  InvoiceQuantityExceedsOrderServiceError,
  InvoiceQuantityExceedsReceiptError,
  InvoiceReceiptNotConfirmedError,
  PurchaseInvoiceAlreadyCancelledError,
  PurchaseInvoiceNotCancellableError,
  PurchaseInvoiceNotConfirmableError,
  PurchaseInvoiceNotFoundError,
  PurchaseInvoiceWithCreditNotesError,
  PurchaseInvoiceWithPaymentsError,
} from '../../domain/errors/purchasing.errors.js';
import {
  INVOICE_REVALUATION_POSTING,
  type InvoiceRevaluationLineData,
  type InvoiceRevaluationPosting,
  type InvoiceWarehouseRevaluationData,
} from '../../../../shared/prisma/invoice-revaluation-posting.js';
import { PurchaseInvoicePosting } from '../../domain/invoice/posting/purchase-invoice-posting.js';
import { PurchaseInvoice, PurchaseInvoiceId } from '../../domain/invoice/purchase-invoice.entity.js';
import {
  calculatePurchasePriceDifference,
  effectiveRateToBase,
} from '../../../../shared/domain/purchase-price-difference.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PURCHASE_INVOICE_INCLUDE, purchaseInvoiceFromRow } from './purchasing-rows.js';
import { BUSINESS_CALENDAR, type BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DOCUMENT_ACCOUNTING_POSTING } from '../../../../shared/prisma/document-accounting-posting.js';
import type { DocumentAccountingPosting } from '../../../../shared/prisma/document-accounting-posting.js';

@Injectable()
export class PrismaPurchaseInvoicePosting implements PurchaseInvoicePosting {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INVOICE_REVALUATION_POSTING) private readonly revaluationPosting: InvoiceRevaluationPosting,
    @Inject(BUSINESS_CALENDAR) private readonly calendar: BusinessCalendar,
    @Inject(DOCUMENT_ACCOUNTING_POSTING) private readonly accounting: DocumentAccountingPosting,
  ) {}

  async confirm(tenantId: TenantId, invoiceId: PurchaseInvoiceId, now: Date, userId?: string): Promise<PurchaseInvoice> {
    const tenant = tenantId.value;

    return this.prisma.$transaction(async (tx) => {
      // 1. Bloquear factura
      const lockedInvoices = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM purchase_invoices
        WHERE tenant_id = ${tenant}::uuid AND id = ${invoiceId.value}::uuid
        FOR UPDATE`;

      if (lockedInvoices.length === 0) {
        throw new PurchaseInvoiceNotFoundError(invoiceId.value);
      }

      const invoiceRow = await tx.purchaseInvoice.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: tenant, id: invoiceId.value } },
        include: PURCHASE_INVOICE_INCLUDE,
      });

      const invoice = purchaseInvoiceFromRow(invoiceRow);
      if (invoice.currentStatus !== 'draft') {
        throw new PurchaseInvoiceNotConfirmableError(invoice.id.value, invoice.currentStatus);
      }

      // 2. Control antifraude de unicidad de numero por proveedor (H9 §3.1)
      const duplicate = await tx.purchaseInvoice.findFirst({
        where: {
          tenantId: tenant,
          supplierId: invoice.supplierId.value,
          supplierInvoiceNumber: invoice.supplierInvoiceNumber.value,
          status: { not: 'cancelled' },
          id: { not: invoice.id.value },
        },
      });
      if (duplicate) {
        throw new DuplicateSupplierInvoiceNumberError(invoice.supplierId.value, invoice.supplierInvoiceNumber.value);
      }

      // 3. Recolectar lineas de entrada y orden
      const lines = invoice.lines();
      const receiptLineIds = lines
        .map((l) => l.receiptLineId)
        .filter((id): id is string => Boolean(id));

      const directOrderLineIds = lines
        .map((l) => l.orderLineId)
        .filter((id): id is string => Boolean(id));

      // Bloquear entradas citadas en orden de id (H9 §4.1 regla 3)
      let receiptLinesMap = new Map<string, { id: string; receiptId: string; orderLineId: string; itemId: string; unitId: string; quantity: number; unitCost: number }>();
      let receiptToOrderMap = new Map<string, string>();
      let receiptWarehouseMap = new Map<string, string>();
      let receiptRateMap = new Map<string, number>();
      let movementByLineId = new Map<string, string>();

      if (receiptLineIds.length > 0) {
        const dbReceiptLines = await tx.goodsReceiptLine.findMany({
          where: { tenantId: tenant, id: { in: receiptLineIds } },
          select: { id: true, receiptId: true, orderLineId: true, itemId: true, unitId: true, quantity: true, unitCost: true },
        });

        for (const rl of dbReceiptLines) {
          receiptLinesMap.set(rl.id, {
            id: rl.id,
            receiptId: rl.receiptId,
            orderLineId: rl.orderLineId,
            itemId: rl.itemId,
            unitId: rl.unitId,
            quantity: Number(rl.quantity),
            unitCost: Number(rl.unitCost),
          });
        }

        const uniqueReceiptIds = [...new Set(dbReceiptLines.map((l) => l.receiptId))].sort();

        const lockedReceipts = await tx.$queryRaw<{
          id: string;
          supplier_id: string;
          status: string;
          order_id: string;
          warehouse_id: string;
          currency: string;
          exchange_rate: string | null;
          base_currency: string;
          base_exchange_rate: string | null;
        }[]>`
          SELECT r.id, r.status, r.order_id, r.warehouse_id, r.currency, r.exchange_rate, r.base_currency, r.base_exchange_rate, o.supplier_id
          FROM goods_receipts r
          JOIN purchase_orders o ON o.id = r.order_id AND o.tenant_id = r.tenant_id
          WHERE r.tenant_id = ${tenant}::uuid AND r.id = ANY(${uniqueReceiptIds}::uuid[])
          ORDER BY r.id
          FOR UPDATE`;

        for (const rec of lockedReceipts) {
          if (rec.status !== 'confirmed') {
            throw new InvoiceReceiptNotConfirmedError(rec.id, rec.status);
          }
          if (rec.supplier_id !== invoice.supplierId.value) {
            throw new InvoiceLinesFromDifferentSupplierError(rec.supplier_id, invoice.supplierId.value);
          }
          receiptToOrderMap.set(rec.id, rec.order_id);
          receiptWarehouseMap.set(rec.id, rec.warehouse_id);
          receiptRateMap.set(
            rec.id,
            effectiveRateToBase(
              rec.currency,
              rec.base_currency,
              rec.exchange_rate ? Number(rec.exchange_rate) : null,
              rec.base_exchange_rate ? Number(rec.base_exchange_rate) : null,
            ),
          );
        }

        const movements = await tx.inventoryMovement.findMany({
          where: {
            tenantId: tenant,
            originType: 'receipt',
            originId: { in: uniqueReceiptIds },
            originLineId: { in: receiptLineIds },
          },
          select: { id: true, originLineId: true },
        });
        for (const m of movements) {
          if (m.originLineId) {
            movementByLineId.set(m.originLineId, m.id);
          }
        }
      }

      // Bloquear ordenes citadas en orden de id (H9 §4.1 regla 3)
      const allOrderLineIds = [
        ...directOrderLineIds,
        ...[...receiptLinesMap.values()].map((rl) => rl.orderLineId),
      ];
      const uniqueOrderLineIds = [...new Set(allOrderLineIds)];

      const dbOrderLines = uniqueOrderLineIds.length > 0
        ? await tx.purchaseOrderLine.findMany({
            where: { tenantId: tenant, id: { in: uniqueOrderLineIds } },
            select: { id: true, orderId: true, itemId: true, unitId: true, quantity: true, invoicedQuantity: true, movesStock: true },
          })
        : [];

      const orderLineMap = new Map(dbOrderLines.map((ol) => [ol.id, ol]));
      const uniqueOrderIds = [...new Set(dbOrderLines.map((ol) => ol.orderId))].sort();

      if (uniqueOrderIds.length > 0) {
        await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM purchase_orders
          WHERE tenant_id = ${tenant}::uuid AND id = ANY(${uniqueOrderIds}::uuid[])
          ORDER BY id
          FOR UPDATE`;
      }

      // Validar limites de cantidades
      // Devoluciones confirmadas de las lineas de entrada
      const returnedQuantities = new Map<string, number>();
      if (receiptLineIds.length > 0) {
        const returnedRows = await tx.purchaseReturnLine.findMany({
          where: {
            tenantId: tenant,
            receiptLineId: { in: receiptLineIds },
            purchaseReturn: {
              tenantId: tenant,
              status: 'confirmed',
            },
          },
          select: { receiptLineId: true, quantity: true },
        });
        for (const r of returnedRows) {
          returnedQuantities.set(r.receiptLineId, (returnedQuantities.get(r.receiptLineId) ?? 0) + Number(r.quantity));
        }
      }

      // Cantidades ya facturadas en facturas confirmadas
      const previouslyInvoicedByReceiptLine = new Map<string, number>();
      if (receiptLineIds.length > 0) {
        const invoicedReceiptRows = await tx.purchaseInvoiceLine.findMany({
          where: {
            tenantId: tenant,
            receiptLineId: { in: receiptLineIds },
            invoice: {
              tenantId: tenant,
              status: 'confirmed',
              id: { not: invoice.id.value },
            },
          },
          select: { receiptLineId: true, quantity: true },
        });
        for (const r of invoicedReceiptRows) {
          if (r.receiptLineId) {
            previouslyInvoicedByReceiptLine.set(
              r.receiptLineId,
              (previouslyInvoicedByReceiptLine.get(r.receiptLineId) ?? 0) + Number(r.quantity),
            );
          }
        }
      }

      const previouslyInvoicedByOrderLine = new Map<string, number>();
      if (directOrderLineIds.length > 0) {
        const invoicedOrderRows = await tx.purchaseInvoiceLine.findMany({
          where: {
            tenantId: tenant,
            orderLineId: { in: directOrderLineIds },
            invoice: {
              tenantId: tenant,
              status: 'confirmed',
              id: { not: invoice.id.value },
            },
          },
          select: { orderLineId: true, quantity: true },
        });
        for (const r of invoicedOrderRows) {
          if (r.orderLineId) {
            previouslyInvoicedByOrderLine.set(
              r.orderLineId,
              (previouslyInvoicedByOrderLine.get(r.orderLineId) ?? 0) + Number(r.quantity),
            );
          }
        }
      }

      // Validar cada linea y calcular diferencias de precio
      const orderLineDeltas = new Map<string, number>();
      let totalPriceDifference = 0;
      let totalExchangeDifference = 0;
      let totalReceiptBaseCost = 0;
      const revaluationsByWarehouse = new Map<string, InvoiceRevaluationLineData[]>();

      for (const line of lines) {
        const lineQty = line.quantity.toNumber();

        if (line.receiptLineId) {
          const receiptLine = receiptLinesMap.get(line.receiptLineId);
          if (!receiptLine) {
            throw new InvoiceItemMismatchError(line.id.value, 'existing receipt line', 'not found');
          }

          if (line.itemId && line.itemId.value !== receiptLine.itemId) {
            throw new InvoiceItemMismatchError(line.id.value, receiptLine.itemId, line.itemId.value);
          }
          if (line.unitId && line.unitId.value !== receiptLine.unitId) {
            throw new InvoiceItemMismatchError(line.id.value, receiptLine.unitId, line.unitId.value);
          }

          const received = receiptLine.quantity;
          const returned = returnedQuantities.get(line.receiptLineId) ?? 0;
          const alreadyInvoiced = previouslyInvoicedByReceiptLine.get(line.receiptLineId) ?? 0;
          const available = Math.max(0, received - returned - alreadyInvoiced);

          if (lineQty > available) {
            throw new InvoiceQuantityExceedsReceiptError(line.receiptLineId, available, lineQty);
          }

          // Sumar para descontar concurrentemente si la misma factura repite la linea
          previouslyInvoicedByReceiptLine.set(line.receiptLineId, alreadyInvoiced + lineQty);

          // Acumular incremento de invoicedQuantity en la orden
          const targetOrderLineId = receiptLine.orderLineId;
          orderLineDeltas.set(targetOrderLineId, (orderLineDeltas.get(targetOrderLineId) ?? 0) + lineQty);

          // Calcular diferencia de precio sobre la entrada
          const invoicedUnitPrice = line.unitPrice.toNumber();
          const invoicedRate = effectiveRateToBase(
            invoice.currency.currency,
            invoice.currency.baseCurrency,
            invoice.currency.exchangeRate,
            invoice.currency.baseExchangeRate,
          );
          const receiptCost = receiptLine.unitCost;
          const receiptRate = receiptRateMap.get(receiptLine.receiptId) ?? 1;

          totalReceiptBaseCost += Number((lineQty * receiptCost * receiptRate).toFixed(2));

          const diff = calculatePurchasePriceDifference([
            {
              quantity: lineQty,
              invoiceUnitPrice: invoicedUnitPrice,
              invoiceRate: invoicedRate,
              receiptUnitCost: receiptCost,
              receiptRate,
            },
          ]);
          const lineDiff = diff.lineDifferences[0];

          if (Math.abs(lineDiff.totalDifferenceDoc) > 0.0001 || Math.abs(lineDiff.priceDifferenceBase) > 0.0001) {
            totalPriceDifference += lineDiff.priceDifferenceBase;
            totalExchangeDifference += lineDiff.exchangeDifferenceBase;

            const warehouseId = receiptWarehouseMap.get(receiptLine.receiptId) ?? '';
            const whLines = revaluationsByWarehouse.get(warehouseId) ?? [];
            whLines.push({
              lineNumber: whLines.length + 1,
              itemId: receiptLine.itemId,
              itemSku: line.itemSku ?? '',
              itemName: line.itemName ?? '',
              unitId: receiptLine.unitId,
              amount: lineDiff.priceDifferenceBase,
              sourceMovementId: movementByLineId.get(line.receiptLineId) ?? '',
              reason: `Diferencia de precio segun factura ${invoice.code}`,
            });
            revaluationsByWarehouse.set(warehouseId, whLines);
          }
        } else if (line.orderLineId) {
          const orderLine = orderLineMap.get(line.orderLineId);
          if (!orderLine) {
            throw new InvoiceItemMismatchError(line.id.value, 'existing order line', 'not found');
          }

          const ordered = Number(orderLine.quantity);
          const alreadyInvoiced = previouslyInvoicedByOrderLine.get(line.orderLineId) ?? 0;
          const available = Math.max(0, ordered - alreadyInvoiced);

          if (lineQty > available) {
            throw new InvoiceQuantityExceedsOrderServiceError(line.orderLineId, available, lineQty);
          }

          previouslyInvoicedByOrderLine.set(line.orderLineId, alreadyInvoiced + lineQty);
          orderLineDeltas.set(line.orderLineId, (orderLineDeltas.get(line.orderLineId) ?? 0) + lineQty);
        }
      }

      // Actualizar invoicedQuantity en las lineas de orden de compra
      for (const [orderLineId, delta] of orderLineDeltas) {
        await tx.purchaseOrderLine.update({
          where: { tenantId_id: { tenantId: tenant, id: orderLineId } },
          data: {
            invoicedQuantity: {
              increment: delta,
            },
          },
        });
      }

      // Actualizar estado de la factura a confirmada
      invoice.confirm(now, totalPriceDifference, totalExchangeDifference);
      const primitives = invoice.toPrimitives();

      await tx.purchaseInvoice.update({
        where: { tenantId_id: { tenantId: tenant, id: primitives.id } },
        data: {
          status: primitives.status,
          priceDifference: totalPriceDifference,
          exchangeDifference: totalExchangeDifference,
          confirmedAt: primitives.confirmedAt,
          updatedAt: primitives.updatedAt,
        },
      });

      if (revaluationsByWarehouse.size > 0) {
        const revalData: InvoiceWarehouseRevaluationData[] = [...revaluationsByWarehouse.entries()].map(
          ([warehouseId, revalLines]) => ({ warehouseId, lines: revalLines }),
        );
        const today = await this.calendar.today(tenant);
        await this.revaluationPosting.createDraftRevaluations(
          tenantId,
          invoice.id.value,
          invoice.code,
          invoice.issueDate.value,
          revalData,
          now,
          today,
          userId,
          tx,
        );
      }

      const isBase = primitives.currency === primitives.baseCurrency;
      const invoicedRate = effectiveRateToBase(
        primitives.currency,
        primitives.baseCurrency,
        primitives.exchangeRate,
        primitives.baseExchangeRate,
      );
      const totalInBase = isBase ? primitives.total : Number((primitives.total * invoicedRate).toFixed(2));
      const taxInBase = isBase ? primitives.tax : Number((primitives.tax * invoicedRate).toFixed(2));

      const serviceLines = primitives.lines
        .filter((l) => !l.receiptLineId)
        .map((l) => ({
          itemId: l.itemId,
          subtotal: isBase ? l.subtotal : Number((l.subtotal * invoicedRate).toFixed(2)),
          tax: isBase ? l.tax : Number((l.tax * invoicedRate).toFixed(2)),
          concept: l.itemName ?? l.itemSku ?? 'Servicio',
        }));

      await this.accounting.post(tx, tenant, {
        kind: 'purchase-invoice-confirmed',
        documentId: invoice.id.value,
        date: primitives.issueDate,
        supplierId: invoice.supplierId.value,
        currency: primitives.currency,
        pricing: {
          baseCost: Number(totalReceiptBaseCost.toFixed(2)),
          priceDifference: totalPriceDifference,
          exchangeDifference: totalExchangeDifference,
          serviceLines,
          tax: taxInBase,
          total: totalInBase,
        },
      });

      return invoice;
    });
  }

  async cancel(tenantId: TenantId, invoiceId: PurchaseInvoiceId, now: Date, userId?: string): Promise<PurchaseInvoice> {
    const tenant = tenantId.value;

    return this.prisma.$transaction(async (tx) => {
      const lockedInvoices = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM purchase_invoices
        WHERE tenant_id = ${tenant}::uuid AND id = ${invoiceId.value}::uuid
        FOR UPDATE`;

      if (lockedInvoices.length === 0) {
        throw new PurchaseInvoiceNotFoundError(invoiceId.value);
      }

      const invoiceRow = await tx.purchaseInvoice.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: tenant, id: invoiceId.value } },
        include: PURCHASE_INVOICE_INCLUDE,
      });

      const invoice = purchaseInvoiceFromRow(invoiceRow);
      if (invoice.currentStatus === 'cancelled') {
        throw new PurchaseInvoiceAlreadyCancelledError(invoice.id.value);
      }
      if (invoice.currentStatus !== 'confirmed') {
        throw new PurchaseInvoiceNotCancellableError(invoice.id.value, invoice.currentStatus);
      }

      // Verificar que no tenga pagos confirmados aplicados
      const paymentsApplied = await tx.supplierPaymentAllocation.findFirst({
        where: {
          tenantId: tenant,
          invoiceId: invoice.id.value,
          payment: {
            tenantId: tenant,
            status: 'confirmed',
          },
        },
      });
      if (paymentsApplied) {
        throw new PurchaseInvoiceWithPaymentsError(invoice.id.value);
      }

      // Verificar que no tenga notas de credito confirmadas asociadas
      const creditNotesApplied = await tx.supplierCreditNote.findFirst({
        where: {
          tenantId: tenant,
          invoiceId: invoice.id.value,
          status: 'confirmed',
        },
      });
      if (creditNotesApplied) {
        throw new PurchaseInvoiceWithCreditNotesError(invoice.id.value);
      }

      // Revertir cantidades en ordenes de compra
      const lines = invoice.lines();
      const receiptLineIds = lines
        .map((l) => l.receiptLineId)
        .filter((id): id is string => Boolean(id));

      const receiptToOrderLineMap = new Map<string, string>();
      if (receiptLineIds.length > 0) {
        const dbReceiptLines = await tx.goodsReceiptLine.findMany({
          where: { tenantId: tenant, id: { in: receiptLineIds } },
          select: { id: true, orderLineId: true },
        });
        for (const rl of dbReceiptLines) {
          receiptToOrderLineMap.set(rl.id, rl.orderLineId);
        }
      }

      const orderLineDeltas = new Map<string, number>();
      for (const line of lines) {
        const lineQty = line.quantity.toNumber();
        let targetOrderLineId: string | null = null;

        if (line.receiptLineId) {
          targetOrderLineId = receiptToOrderLineMap.get(line.receiptLineId) ?? null;
        } else if (line.orderLineId) {
          targetOrderLineId = line.orderLineId;
        }

        if (targetOrderLineId) {
          orderLineDeltas.set(targetOrderLineId, (orderLineDeltas.get(targetOrderLineId) ?? 0) + lineQty);
        }
      }

      // Bloquear ordenes antes de actualizar
      const targetOrderLineIds = [...orderLineDeltas.keys()];
      if (targetOrderLineIds.length > 0) {
        const orders = await tx.purchaseOrderLine.findMany({
          where: { tenantId: tenant, id: { in: targetOrderLineIds } },
          select: { orderId: true },
        });
        const uniqueOrderIds = [...new Set(orders.map((o) => o.orderId))].sort();
        if (uniqueOrderIds.length > 0) {
          await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM purchase_orders
            WHERE tenant_id = ${tenant}::uuid AND id = ANY(${uniqueOrderIds}::uuid[])
            ORDER BY id
            FOR UPDATE`;
        }

        for (const [orderLineId, delta] of orderLineDeltas) {
          await tx.purchaseOrderLine.update({
            where: { tenantId_id: { tenantId: tenant, id: orderLineId } },
            data: {
              invoicedQuantity: {
                decrement: delta,
              },
            },
          });
        }
      }

      // Anular factura
      invoice.cancel(now);
      const primitives = invoice.toPrimitives();

      await tx.purchaseInvoice.update({
        where: { tenantId_id: { tenantId: tenant, id: primitives.id } },
        data: {
          status: primitives.status,
          cancelledAt: primitives.cancelledAt,
          updatedAt: primitives.updatedAt,
        },
      });

      const today = await this.calendar.today(tenant);
      await this.revaluationPosting.cancelOrReverseRevaluations(
        tenantId,
        invoice.id.value,
        invoice.code,
        now,
        today,
        userId,
        tx,
      );

      await this.accounting.post(tx, tenant, {
        kind: 'document-cancelled',
        originType: 'purchase_invoice',
        originId: invoice.id.value,
        date: now,
      });

      return invoice;
    });
  }
}
