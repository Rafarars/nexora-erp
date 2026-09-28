import { DuplicateSupplierInvoiceNumberError } from '../../domain/errors/purchasing.errors.js';
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

export class InMemoryPurchaseInvoiceRepository implements PurchaseInvoiceRepository {
  private readonly items = new Map<string, PurchaseInvoice>();

  private key(tenantId: TenantId, id: PurchaseInvoiceId): string {
    return `${tenantId.value}:${id.value}`;
  }

  async save(invoice: PurchaseInvoice): Promise<void> {
    if (invoice.currentStatus !== 'cancelled') {
      const active = await this.findActiveBySupplierNumber(
        invoice.tenantId,
        invoice.supplierId,
        invoice.supplierInvoiceNumber.value,
      );
      if (active && !active.id.equals(invoice.id)) {
        throw new DuplicateSupplierInvoiceNumberError(invoice.supplierId.value, invoice.supplierInvoiceNumber.value);
      }
    }
    // Almacenar clon para simular persistencia
    const primitives = invoice.toPrimitives();
    this.items.set(this.key(invoice.tenantId, invoice.id), PurchaseInvoice.fromPrimitives(primitives));
  }

  async findById(tenantId: TenantId, id: PurchaseInvoiceId): Promise<PurchaseInvoice | null> {
    const found = this.items.get(this.key(tenantId, id));
    if (!found) return null;
    return PurchaseInvoice.fromPrimitives(found.toPrimitives());
  }

  async findByCode(tenantId: TenantId, code: string): Promise<PurchaseInvoice | null> {
    for (const inv of this.items.values()) {
      if (inv.tenantId.equals(tenantId) && inv.code === code) {
        return PurchaseInvoice.fromPrimitives(inv.toPrimitives());
      }
    }
    return null;
  }

  async findActiveBySupplierNumber(
    tenantId: TenantId,
    supplierId: SupplierId,
    number: string,
  ): Promise<PurchaseInvoice | null> {
    const normalized = number.trim().toUpperCase();
    for (const inv of this.items.values()) {
      if (
        inv.tenantId.equals(tenantId) &&
        inv.supplierId.equals(supplierId) &&
        inv.supplierInvoiceNumber.value === normalized &&
        inv.currentStatus !== 'cancelled'
      ) {
        return PurchaseInvoice.fromPrimitives(inv.toPrimitives());
      }
    }
    return null;
  }

  async search(
    tenantId: TenantId,
    criteria: PurchaseInvoiceSearchCriteria,
  ): Promise<{ invoices: PurchaseInvoice[]; total: number }> {
    const matches: PurchaseInvoice[] = [];

    for (const inv of this.items.values()) {
      if (!inv.tenantId.equals(tenantId)) continue;
      if (criteria.supplierId && inv.supplierId.value !== criteria.supplierId) continue;
      if (criteria.status && inv.currentStatus !== criteria.status) continue;
      if (criteria.fromDate && inv.issueDate.value < criteria.fromDate) continue;
      if (criteria.toDate && inv.issueDate.value > criteria.toDate) continue;
      matches.push(PurchaseInvoice.fromPrimitives(inv.toPrimitives()));
    }

    matches.sort((a, b) => b.code.localeCompare(a.code));
    const total = matches.length;
    const paginated = matches.slice(criteria.offset, criteria.offset + criteria.limit);

    return { invoices: paginated, total };
  }

  async invoicedQuantitiesByReceiptLine(
    tenantId: TenantId,
    receiptLineIds: string[],
    excludeInvoiceId?: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const idSet = new Set(receiptLineIds);

    for (const inv of this.items.values()) {
      if (!inv.tenantId.equals(tenantId)) continue;
      if (inv.currentStatus !== 'confirmed') continue;
      if (excludeInvoiceId && inv.id.value === excludeInvoiceId) continue;

      for (const line of inv.lines()) {
        if (line.receiptLineId && idSet.has(line.receiptLineId)) {
          map.set(line.receiptLineId, (map.get(line.receiptLineId) ?? 0) + line.quantity.toNumber());
        }
      }
    }

    return map;
  }

  async invoicedQuantitiesByOrderLine(
    tenantId: TenantId,
    orderLineIds: string[],
    excludeInvoiceId?: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const idSet = new Set(orderLineIds);

    for (const inv of this.items.values()) {
      if (!inv.tenantId.equals(tenantId)) continue;
      if (inv.currentStatus !== 'confirmed') continue;
      if (excludeInvoiceId && inv.id.value === excludeInvoiceId) continue;

      for (const line of inv.lines()) {
        if (line.orderLineId && idSet.has(line.orderLineId)) {
          map.set(line.orderLineId, (map.get(line.orderLineId) ?? 0) + line.quantity.toNumber());
        }
      }
    }

    return map;
  }
}
