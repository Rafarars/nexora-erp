import { describe, expect, it } from 'vitest';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import {
  DuplicatePurchaseInvoiceLineError,
  EmptyPurchaseInvoiceError,
  FuturePurchaseDateError,
  InvoiceDueDateBeforeIssueDateError,
  PurchaseInvoiceAlreadyCancelledError,
  PurchaseInvoiceNotConfirmableError,
  PurchaseInvoiceNotEditableError,
} from '../errors/purchasing.errors.js';
import { TaxRate, UnitCost } from '../shared/money.js';
import { PurchaseDate } from '../shared/purchase-date.vo.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { SupplierId } from '../supplier/supplier.entity.js';
import { PurchaseInvoiceId } from './purchase-invoice-id.vo.js';
import { PurchaseInvoiceLine, PurchaseInvoiceLineId } from './purchase-invoice-line.js';
import { PurchaseInvoice } from './purchase-invoice.entity.js';
import { SupplierInvoiceNumber } from './supplier-invoice-number.vo.js';

const TENANT_ID = TenantId.of('a0000000-0000-4000-8000-000000000001');
const SUPPLIER_ID = SupplierId.of('b0000000-0000-4000-8000-000000000001');
const ITEM_ID = ItemRef.of('c0000000-0000-4000-8000-000000000001');
const UNIT_ID = UnitRef.of('d0000000-0000-4000-8000-000000000001');

function sampleCurrency(): DocumentCurrency {
  return DocumentCurrency.fromPrimitives({
    currency: 'USD',
    exchangeRate: null,
    baseCurrency: 'USD',
    baseExchangeRate: null,
    manualExchangeRate: false,
  });
}

function sampleLine(id: string = 'e0000000-0000-4000-8000-000000000001', qty: number = 10, cost: number = 15): PurchaseInvoiceLine {
  return PurchaseInvoiceLine.of({
    id: PurchaseInvoiceLineId.of(id),
    lineNumber: 1,
    receiptLineId: null,
    orderLineId: null,
    itemId: ITEM_ID,
    itemSku: 'SKU-01',
    itemName: 'Producto 1',
    concept: null,
    unitId: UNIT_ID,
    quantity: Quantity.of(qty),
    unitPrice: UnitCost.of(cost),
    taxRate: TaxRate.of(16),
  });
}

describe('PurchaseInvoice entity', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const today = '2026-09-28';

  it('creates draft purchase invoice and computes totals correctly', () => {
    const invoice = PurchaseInvoice.draft(
      PurchaseInvoiceId.of('f0000000-0000-4000-8000-000000000001'),
      TENANT_ID,
      'FCP-000001',
      {
        supplierId: SUPPLIER_ID,
        supplierInvoiceNumber: SupplierInvoiceNumber.of('  fac-00123  '),
        supplierInvoiceSeries: 'A',
        issueDate: PurchaseDate.of('2026-09-20'),
        dueDate: PurchaseDate.of('2026-09-25'),
        notes: 'Factura de prueba',
        lines: [sampleLine()],
        currency: sampleCurrency(),
      },
      now,
      today,
    );

    expect(invoice.currentStatus).toBe('draft');
    expect(invoice.supplierInvoiceNumber.value).toBe('FAC-00123');
    const totals = invoice.totals(2);
    expect(totals.subtotal).toBe(150);
    expect(totals.tax).toBe(24);
    expect(totals.total).toBe(174);
  });

  it('normalizes supplier invoice number to uppercase without whitespace', () => {
    const num = SupplierInvoiceNumber.of('   fac-xyz-999  ');
    expect(num.value).toBe('FAC-XYZ-999');
  });

  it('rejects invoice without lines', () => {
    expect(() =>
      PurchaseInvoice.draft(
        PurchaseInvoiceId.of('f0000000-0000-4000-8000-000000000001'),
        TENANT_ID,
        'FCP-000001',
        {
          supplierId: SUPPLIER_ID,
          supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-001'),
          supplierInvoiceSeries: null,
          issueDate: PurchaseDate.of('2026-09-20'),
          dueDate: PurchaseDate.of('2026-09-25'),
          notes: null,
          lines: [],
          currency: sampleCurrency(),
        },
        now,
        today,
      ),
    ).toThrow(EmptyPurchaseInvoiceError);
  });

  it('rejects future issue date', () => {
    expect(() =>
      PurchaseInvoice.draft(
        PurchaseInvoiceId.of('f0000000-0000-4000-8000-000000000001'),
        TENANT_ID,
        'FCP-000001',
        {
          supplierId: SUPPLIER_ID,
          supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-001'),
          supplierInvoiceSeries: null,
          issueDate: PurchaseDate.of('2026-10-01'),
          dueDate: PurchaseDate.of('2026-10-05'),
          notes: null,
          lines: [sampleLine()],
          currency: sampleCurrency(),
        },
        now,
        today,
      ),
    ).toThrow(FuturePurchaseDateError);
  });

  it('rejects due date earlier than issue date (H9 §4.1 regla 2)', () => {
    expect(() =>
      PurchaseInvoice.draft(
        PurchaseInvoiceId.of('f0000000-0000-4000-8000-000000000001'),
        TENANT_ID,
        'FCP-000001',
        {
          supplierId: SUPPLIER_ID,
          supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-001'),
          supplierInvoiceSeries: null,
          issueDate: PurchaseDate.of('2026-09-20'),
          dueDate: PurchaseDate.of('2026-09-15'),
          notes: null,
          lines: [sampleLine()],
          currency: sampleCurrency(),
        },
        now,
        today,
      ),
    ).toThrow(InvoiceDueDateBeforeIssueDateError);
  });

  it('rejects duplicate lines by id', () => {
    const line1 = sampleLine('e0000000-0000-4000-8000-000000000001');
    const line2 = sampleLine('e0000000-0000-4000-8000-000000000001');

    expect(() =>
      PurchaseInvoice.draft(
        PurchaseInvoiceId.of('f0000000-0000-4000-8000-000000000001'),
        TENANT_ID,
        'FCP-000001',
        {
          supplierId: SUPPLIER_ID,
          supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-001'),
          supplierInvoiceSeries: null,
          issueDate: PurchaseDate.of('2026-09-20'),
          dueDate: PurchaseDate.of('2026-09-25'),
          notes: null,
          lines: [line1, line2],
          currency: sampleCurrency(),
        },
        now,
        today,
      ),
    ).toThrow(DuplicatePurchaseInvoiceLineError);
  });

  it('supports confirmation and cancellation lifecycle', () => {
    const invoice = PurchaseInvoice.draft(
      PurchaseInvoiceId.of('f0000000-0000-4000-8000-000000000001'),
      TENANT_ID,
      'FCP-000001',
      {
        supplierId: SUPPLIER_ID,
        supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-001'),
        supplierInvoiceSeries: null,
        issueDate: PurchaseDate.of('2026-09-20'),
        dueDate: PurchaseDate.of('2026-09-25'),
        notes: null,
        lines: [sampleLine()],
        currency: sampleCurrency(),
      },
      now,
      today,
    );

    invoice.confirm(now);
    expect(invoice.currentStatus).toBe('confirmed');

    // Cannot edit confirmed invoice
    expect(() =>
      invoice.update(
        {
          supplierId: SUPPLIER_ID,
          supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-002'),
          supplierInvoiceSeries: null,
          issueDate: PurchaseDate.of('2026-09-20'),
          dueDate: PurchaseDate.of('2026-09-25'),
          notes: null,
          lines: [sampleLine()],
          currency: sampleCurrency(),
        },
        now,
        today,
      ),
    ).toThrow(PurchaseInvoiceNotEditableError);

    // Cannot confirm again
    expect(() => invoice.confirm(now)).toThrow(PurchaseInvoiceNotConfirmableError);

    // Cancel invoice
    invoice.cancel(now);
    expect(invoice.currentStatus).toBe('cancelled');

    // Cannot cancel again
    expect(() => invoice.cancel(now)).toThrow(PurchaseInvoiceAlreadyCancelledError);
  });
});
