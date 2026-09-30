import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { PayableInvoice } from '../../domain/ledger/payable-invoice.js';
import {
  PayableConfirmedReturn,
  PayableInvoiceFilter,
  PayableInvoiceLineInfo,
  PayableSupplier,
  PayableSupplierFilter,
  PayablesLedger,
} from '../../domain/ledger/payables-ledger.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { asDate, invoiceFromRow, invoiceSelect, supplierFromRow } from './payables-rows.js';

const SUPPLIER_SELECT = { id: true, code: true, name: true, paymentTermDays: true, isActive: true } as const;

const like = (text: string) => ({ contains: text, mode: 'insensitive' as const });

// Lee proveedores y facturas de compra de las tablas de compras, como el inventario lee las del catalogo.
@Injectable()
export class PrismaPayablesLedger implements PayablesLedger {
  constructor(private readonly prisma: PrismaService) {}

  async suppliers(tenantId: TenantId, filter: PayableSupplierFilter = {}): Promise<PayableSupplier[]> {
    const text = filter.text ?? null;
    const rows = await this.prisma.supplier.findMany({
      where: { tenantId: tenantId.value, ...(text ? { OR: [{ code: like(text) }, { name: like(text) }] } : {}) },
      select: SUPPLIER_SELECT,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });

    return rows.map(supplierFromRow);
  }

  async supplier(tenantId: TenantId, supplierId: string): Promise<PayableSupplier | null> {
    const row = await this.prisma.supplier.findFirst({ where: { tenantId: tenantId.value, id: supplierId }, select: SUPPLIER_SELECT });

    return row ? supplierFromRow(row) : null;
  }

  async invoices(tenantId: TenantId, filter: PayableInvoiceFilter = {}): Promise<PayableInvoice[]> {
    const text = filter.text ?? null;
    const rows = await this.prisma.purchaseInvoice.findMany({
      where: {
        tenantId: tenantId.value,
        ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
        ...(filter.ids ? { id: { in: filter.ids } } : {}),
        ...(filter.onlyConfirmed ? { status: 'confirmed' as const } : {}),
        ...(filter.from || filter.to ? { dueDate: { ...(filter.from ? { gte: asDate(filter.from) } : {}), ...(filter.to ? { lte: asDate(filter.to) } : {}) } } : {}),
        ...(text ? { OR: [{ code: like(text) }, { supplierInvoiceNumber: like(text) }, { supplier: { name: like(text) } }] } : {}),
      },
      select: invoiceSelect(),
      orderBy: { code: 'desc' },
    });

    return rows.map(invoiceFromRow);
  }

  async invoiceLines(tenantId: TenantId, invoiceId: string): Promise<PayableInvoiceLineInfo[]> {
    const rows = await this.prisma.purchaseInvoiceLine.findMany({
      where: { tenantId: tenantId.value, invoiceId },
      select: { id: true, itemId: true, subtotal: true, receiptLineId: true, unitPrice: true },
    });
    return rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      subtotal: Number(r.subtotal),
      receiptLineId: r.receiptLineId,
      unitPrice: Number(r.unitPrice),
    }));
  }

  async returnReceiptLineIds(tenantId: TenantId, returnId: string): Promise<string[]> {
    const rows = await this.prisma.purchaseReturnLine.findMany({
      where: { tenantId: tenantId.value, purchaseReturnId: returnId },
      select: { receiptLineId: true },
    });
    return rows.map((r) => r.receiptLineId);
  }

  async purchaseReturns(tenantId: TenantId, returnIds: string[]): Promise<Array<{ id: string; code: string }>> {
    if (returnIds.length === 0) return [];
    const rows = await this.prisma.purchaseReturn.findMany({
      where: { tenantId: tenantId.value, id: { in: returnIds } },
      select: { id: true, code: true },
    });
    return rows;
  }

  async confirmedReturnsBySupplier(tenantId: TenantId, supplierId: string): Promise<PayableConfirmedReturn[]> {
    const rows = await this.prisma.purchaseReturn.findMany({
      where: {
        tenantId: tenantId.value,
        supplierId,
        status: 'confirmed',
      },
      select: {
        id: true,
        code: true,
        returnDate: true,
        supplierId: true,
        lines: {
          select: {
            id: true,
            receiptLineId: true,
            itemId: true,
            itemSku: true,
            itemName: true,
            unitId: true,
            quantity: true,
            unitCost: true,
          },
        },
      },
      orderBy: { code: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      date: r.returnDate.toISOString().slice(0, 10),
      supplierId: r.supplierId,
      lines: r.lines.map((l) => ({
        id: l.id,
        receiptLineId: l.receiptLineId,
        itemId: l.itemId,
        itemSku: l.itemSku,
        itemName: l.itemName,
        unitId: l.unitId,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
      })),
    }));
  }
}
