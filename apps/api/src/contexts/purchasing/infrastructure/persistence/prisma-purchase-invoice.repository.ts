import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { DuplicateSupplierInvoiceNumberError } from '../../domain/errors/purchasing.errors.js';
import { violates } from '../../../../shared/prisma/unique-violation.js';
import {
  PurchaseInvoice,
  PurchaseInvoiceId,
} from '../../domain/invoice/purchase-invoice.entity.js';
import {
  PurchaseInvoiceRepository,
  PurchaseInvoiceSearchCriteria,
} from '../../domain/invoice/purchase-invoice.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import {
  PURCHASE_INVOICE_INCLUDE,
  asDate,
  purchaseInvoiceFromRow,
} from './purchasing-rows.js';

@Injectable()
export class PrismaPurchaseInvoiceRepository implements PurchaseInvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(invoice: PurchaseInvoice): Promise<void> {
    const raw = invoice.toPrimitives();
    const tenantId = raw.tenantId;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.purchaseInvoice.upsert({
          where: { tenantId_id: { tenantId, id: raw.id } },
          create: {
            id: raw.id,
            tenantId,
            code: raw.code,
            supplierId: raw.supplierId,
            supplierInvoiceNumber: raw.supplierInvoiceNumber,
            supplierInvoiceSeries: raw.supplierInvoiceSeries,
            issueDate: asDate(raw.issueDate),
            dueDate: asDate(raw.dueDate),
            notes: raw.notes,
            status: raw.status,
            currency: raw.currency,
            exchangeRate: raw.exchangeRate,
            baseCurrency: raw.baseCurrency,
            baseExchangeRate: raw.baseExchangeRate,
            manualExchangeRate: raw.manualExchangeRate,
            subtotal: raw.subtotal,
            tax: raw.tax,
            total: raw.total,
            subtotalVes: raw.subtotalVes,
            taxVes: raw.taxVes,
            totalVes: raw.totalVes,
            priceDifference: raw.priceDifference,
            exchangeDifference: raw.exchangeDifference,
            confirmedAt: raw.confirmedAt,
            cancelledAt: raw.cancelledAt,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
          },
          update: {
            supplierId: raw.supplierId,
            supplierInvoiceNumber: raw.supplierInvoiceNumber,
            supplierInvoiceSeries: raw.supplierInvoiceSeries,
            issueDate: asDate(raw.issueDate),
            dueDate: asDate(raw.dueDate),
            notes: raw.notes,
            status: raw.status,
            currency: raw.currency,
            exchangeRate: raw.exchangeRate,
            baseCurrency: raw.baseCurrency,
            baseExchangeRate: raw.baseExchangeRate,
            manualExchangeRate: raw.manualExchangeRate,
            subtotal: raw.subtotal,
            tax: raw.tax,
            total: raw.total,
            subtotalVes: raw.subtotalVes,
            taxVes: raw.taxVes,
            totalVes: raw.totalVes,
            priceDifference: raw.priceDifference,
            exchangeDifference: raw.exchangeDifference,
            confirmedAt: raw.confirmedAt,
            cancelledAt: raw.cancelledAt,
            updatedAt: raw.updatedAt,
          },
        });

        // Sincronizar lineas
        await tx.purchaseInvoiceLine.deleteMany({
          where: { tenantId, invoiceId: raw.id },
        });

        await tx.purchaseInvoiceLine.createMany({
          data: raw.lines.map((line) => ({
            id: line.id,
            tenantId,
            invoiceId: raw.id,
            lineNumber: line.lineNumber,
            receiptLineId: line.receiptLineId,
            orderLineId: line.orderLineId,
            itemId: line.itemId,
            itemSku: line.itemSku,
            itemName: line.itemName,
            concept: line.concept,
            unitId: line.unitId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            subtotal: line.subtotal,
            tax: line.tax,
            total: line.total,
          })),
        });
      });
    } catch (error) {
      if (
        violates(error, 'purchase_invoices_one_active_number_per_supplier') ||
        violates(error, 'supplier_invoice_number') ||
        violates(error, 'supplierInvoiceNumber')
      ) {
        throw new DuplicateSupplierInvoiceNumberError(raw.supplierId, raw.supplierInvoiceNumber);
      }
      throw error;
    }
  }

  async findById(tenantId: TenantId, id: PurchaseInvoiceId): Promise<PurchaseInvoice | null> {
    const row = await this.prisma.purchaseInvoice.findUnique({
      where: { tenantId_id: { tenantId: tenantId.value, id: id.value } },
      include: PURCHASE_INVOICE_INCLUDE,
    });
    return row ? purchaseInvoiceFromRow(row) : null;
  }

  async findByCode(tenantId: TenantId, code: string): Promise<PurchaseInvoice | null> {
    const row = await this.prisma.purchaseInvoice.findUnique({
      where: { tenantId_code: { tenantId: tenantId.value, code } },
      include: PURCHASE_INVOICE_INCLUDE,
    });
    return row ? purchaseInvoiceFromRow(row) : null;
  }

  async findActiveBySupplierNumber(
    tenantId: TenantId,
    supplierId: SupplierId,
    number: string,
  ): Promise<PurchaseInvoice | null> {
    const normalized = number.trim().toUpperCase();
    const row = await this.prisma.purchaseInvoice.findFirst({
      where: {
        tenantId: tenantId.value,
        supplierId: supplierId.value,
        supplierInvoiceNumber: normalized,
        status: { not: 'cancelled' },
      },
      include: PURCHASE_INVOICE_INCLUDE,
    });
    return row ? purchaseInvoiceFromRow(row) : null;
  }

  async search(
    tenantId: TenantId,
    criteria: PurchaseInvoiceSearchCriteria,
  ): Promise<{ invoices: PurchaseInvoice[]; total: number }> {
    const where = {
      tenantId: tenantId.value,
      ...(criteria.supplierId ? { supplierId: criteria.supplierId } : {}),
      ...(criteria.status ? { status: criteria.status } : {}),
      ...(criteria.fromDate || criteria.toDate
        ? {
            issueDate: {
              ...(criteria.fromDate ? { gte: asDate(criteria.fromDate) } : {}),
              ...(criteria.toDate ? { lte: asDate(criteria.toDate) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({
        where,
        include: PURCHASE_INVOICE_INCLUDE,
        orderBy: { code: 'desc' },
        take: criteria.limit,
        skip: criteria.offset,
      }),
      this.prisma.purchaseInvoice.count({ where }),
    ]);

    return {
      invoices: rows.map(purchaseInvoiceFromRow),
      total,
    };
  }

  async invoicedQuantitiesByReceiptLine(
    tenantId: TenantId,
    receiptLineIds: string[],
    excludeInvoiceId?: string,
  ): Promise<Map<string, number>> {
    if (receiptLineIds.length === 0) return new Map();

    const rows = await this.prisma.purchaseInvoiceLine.findMany({
      where: {
        tenantId: tenantId.value,
        receiptLineId: { in: receiptLineIds },
        invoice: {
          tenantId: tenantId.value,
          status: 'confirmed',
          ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
        },
      },
      select: {
        receiptLineId: true,
        quantity: true,
      },
    });

    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.receiptLineId) {
        map.set(r.receiptLineId, (map.get(r.receiptLineId) ?? 0) + Number(r.quantity));
      }
    }
    return map;
  }

  async invoicedQuantitiesByOrderLine(
    tenantId: TenantId,
    orderLineIds: string[],
    excludeInvoiceId?: string,
  ): Promise<Map<string, number>> {
    if (orderLineIds.length === 0) return new Map();

    const rows = await this.prisma.purchaseInvoiceLine.findMany({
      where: {
        tenantId: tenantId.value,
        orderLineId: { in: orderLineIds },
        invoice: {
          tenantId: tenantId.value,
          status: 'confirmed',
          ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
        },
      },
      select: {
        orderLineId: true,
        quantity: true,
      },
    });

    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.orderLineId) {
        map.set(r.orderLineId, (map.get(r.orderLineId) ?? 0) + Number(r.quantity));
      }
    }
    return map;
  }
}
