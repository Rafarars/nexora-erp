import { describe, expect, it } from 'vitest';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { PurchaseOrderId, PurchaseOrder } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderLine, PurchaseOrderLineId } from '../../domain/order/purchase-order-line.js';
import { GoodsReceipt, GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptLine, GoodsReceiptLineId } from '../../domain/receipt/goods-receipt-line.js';
import { PurchaseReturn, PurchaseReturnId } from '../../domain/return/purchase-return.entity.js';
import { PurchaseReturnLine } from '../../domain/return/purchase-return-line.js';
import { PurchaseInvoice, PurchaseInvoiceId } from '../../domain/invoice/purchase-invoice.entity.js';
import { PurchaseInvoiceLine, PurchaseInvoiceLineId } from '../../domain/invoice/purchase-invoice-line.js';
import { SupplierInvoiceNumber } from '../../domain/invoice/supplier-invoice-number.vo.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { Quantity } from '../../domain/shared/quantity.vo.js';
import { TaxRate, UnitCost } from '../../domain/shared/money.js';
import { InMemoryPurchaseInvoiceRepository } from '../../infrastructure/testing/in-memory-purchase-invoice.repository.js';
import { ThreeWayMatcher } from './three-way-matcher.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SUPPLIER = 'a1111111-1111-4111-8111-111111111111';
const WAREHOUSE = '01111111-1111-4111-8111-111111111111';
const ITEM_PRODUCT = 'f1111111-1111-4111-8111-111111111111';
const ITEM_SERVICE = 'f2222222-2222-4222-8222-222222222222';
const UNIT = '03333333-3333-4333-8333-333333333333';

function sampleCurrency(): DocumentCurrency {
  return DocumentCurrency.fromPrimitives({
    currency: 'USD',
    exchangeRate: null,
    baseCurrency: 'USD',
    baseExchangeRate: null,
    manualExchangeRate: false,
  });
}

describe('ThreeWayMatcher application service (H9 Fase 2)', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const today = '2026-10-10';

  const orderId = PurchaseOrderId.of('b1111111-1111-4111-8111-111111111111');
  const orderLineProduct = PurchaseOrderLine.of({
    id: PurchaseOrderLineId.of('b2222222-2222-4222-8222-111111111111'),
    lineNumber: 1,
    itemId: ItemRef.of(ITEM_PRODUCT),
    itemSku: 'PRD-01',
    itemName: 'Producto General',
    unitId: UnitRef.of(UNIT),
    quantity: Quantity.of(20),
    baseQuantity: Quantity.of(20),
    unitCost: UnitCost.of(10),
    taxRate: TaxRate.of(16),
    movesStock: true,
  });
  const orderLineService = PurchaseOrderLine.of({
    id: PurchaseOrderLineId.of('b2222222-2222-4222-8222-222222222222'),
    lineNumber: 2,
    itemId: ItemRef.of(ITEM_SERVICE),
    itemSku: 'SRV-01',
    itemName: 'Transporte',
    unitId: UnitRef.of(UNIT),
    quantity: Quantity.of(5),
    baseQuantity: Quantity.of(5),
    unitCost: UnitCost.of(50),
    taxRate: TaxRate.of(16),
    movesStock: false,
  });

  const order = PurchaseOrder.draft(
    orderId,
    TenantId.of(TENANT),
    'OC-000001',
    {
      supplierId: SupplierId.of(SUPPLIER),
      warehouseId: WarehouseRef.of(WAREHOUSE),
      orderDate: PurchaseDate.of('2026-10-01'),
      expectedDate: null,
      notes: null,
      paymentTermDays: 30,
      lines: [orderLineProduct, orderLineService],
      currency: sampleCurrency(),
    },
    now,
    today,
  );
  order.confirm(now);

  const receiptId = GoodsReceiptId.of('e1111111-1111-4111-8111-111111111111');
  const receiptLineId = GoodsReceiptLineId.of('e2222222-2222-4222-8222-111111111111');
  const receiptLine = GoodsReceiptLine.of({
    id: receiptLineId,
    lineNumber: 1,
    orderLineId: orderLineProduct.id,
    itemId: ItemRef.of(ITEM_PRODUCT),
    itemSku: 'PRD-01',
    itemName: 'Producto General',
    unitId: UnitRef.of(UNIT),
    quantity: Quantity.of(15),
    baseQuantity: Quantity.of(15),
    unitCost: UnitCost.of(10),
  });
  const receipt = GoodsReceipt.draft(
    receiptId,
    TenantId.of(TENANT),
    'ENT-000001',
    { id: orderId, warehouseId: WarehouseRef.of(WAREHOUSE), date: PurchaseDate.of('2026-10-01') },
    {
      date: PurchaseDate.of('2026-10-02'),
      notes: null,
      lines: [receiptLine],
      currency: sampleCurrency(),
    },
    now,
    today,
  );
  receipt.confirm(now);

  // Devolucion de 3 unidades
  const returnId = PurchaseReturnId.of('e3333333-3333-4333-8333-333333333333');
  const returnLine = PurchaseReturnLine.of({
    id: { value: 'e4444444-4444-4444-8444-444444444444' } as any,
    lineNumber: 1,
    receiptLineId: receiptLineId.value,
    itemId: ItemRef.of(ITEM_PRODUCT),
    itemSku: 'PRD-01',
    itemName: 'Producto General',
    unitId: UnitRef.of(UNIT),
    quantity: Quantity.of(3),
    baseQuantity: Quantity.of(3),
    unitCost: UnitCost.of(10),
    restoresMovementId: 'mov-1',
  });
  const returnDoc = PurchaseReturn.draft(
    returnId,
    TenantId.of(TENANT),
    'DVC-000001',
    { id: SupplierId.of(SUPPLIER) },
    { id: receiptId, warehouseId: WarehouseRef.of(WAREHOUSE), date: receipt.date() },
    sampleCurrency(),
    {
      date: PurchaseDate.of('2026-10-05'),
      reason: 'defect',
      notes: null,
      lines: [returnLine],
    },
    now,
    today,
  );
  returnDoc.confirm(now, new Map([[returnLine.id.value, 'mov-1']]));

  const mockReceiptsRepo: any = {
    searchByTenant: async () => [receipt],
    find: async (_t: any, id: any) => (id.value === receipt.id.value ? receipt : null),
  };
  const mockOrdersRepo: any = {
    searchByTenant: async () => [order],
    find: async (_t: any, id: any) => (id.value === order.id.value ? order : null),
  };
  const mockReturnsRepo: any = {
    returnedQuantitiesByReceipt: async () => new Map([[receiptLineId.value, 3]]),
  };

  it('matches perfectly when quantity and price match receipt and order', async () => {
    const invoices = new InMemoryPurchaseInvoiceRepository();
    const matcher = new ThreeWayMatcher(invoices, mockReceiptsRepo, mockOrdersRepo, mockReturnsRepo);

    // Entrada: 15 recibidas, 3 devueltas => 12 disponibles. Facturamos 12 a precio 10.
    const invId = PurchaseInvoiceId.of('f1111111-1111-4111-8111-111111111111');
    const invoice = PurchaseInvoice.draft(
      invId,
      TenantId.of(TENANT),
      'FCP-000001',
      {
        supplierId: SupplierId.of(SUPPLIER),
        supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-PERFECT'),
        supplierInvoiceSeries: null,
        issueDate: PurchaseDate.of('2026-10-06'),
        dueDate: PurchaseDate.of('2026-10-20'),
        notes: null,
        currency: sampleCurrency(),
        lines: [
          PurchaseInvoiceLine.of({
            id: PurchaseInvoiceLineId.of('f2222222-1111-4111-8111-111111111111'),
            lineNumber: 1,
            receiptLineId: receiptLineId.value,
            orderLineId: null,
            itemId: ItemRef.of(ITEM_PRODUCT),
            itemSku: 'PRD-01',
            itemName: 'Producto General',
            concept: null,
            unitId: UnitRef.of(UNIT),
            quantity: Quantity.of(12),
            unitPrice: UnitCost.of(10),
            taxRate: TaxRate.of(16),
          }),
        ],
      },
      now,
      today,
    );
    await invoices.save(invoice);

    const match = await matcher.run(TENANT, invId.value);

    expect(match.hasDiscrepancies).toBe(false);
    expect(match.hasQuantityExceeded).toBe(false);
    expect(match.totalPriceDifference).toBe(0);
    expect(match.lines).toHaveLength(1);
    expect(match.lines[0].receivedQuantity).toBe(15);
    expect(match.lines[0].returnedQuantity).toBe(3);
    expect(match.lines[0].availableQuantity).toBe(12);
    expect(match.lines[0].invoicedQuantity).toBe(12);
    expect(match.lines[0].quantityMismatch).toBe(false);
    expect(match.lines[0].priceMismatch).toBe(false);
  });

  it('detects price difference without exceeding quantity', async () => {
    const invoices = new InMemoryPurchaseInvoiceRepository();
    const matcher = new ThreeWayMatcher(invoices, mockReceiptsRepo, mockOrdersRepo, mockReturnsRepo);

    // Precio 12 en vez de 10 (+2 Bs de diferencia unitaria)
    const invId = PurchaseInvoiceId.of('f1111111-1111-4111-8111-222222222222');
    const invoice = PurchaseInvoice.draft(
      invId,
      TenantId.of(TENANT),
      'FCP-000002',
      {
        supplierId: SupplierId.of(SUPPLIER),
        supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-PRICE-DIFF'),
        supplierInvoiceSeries: null,
        issueDate: PurchaseDate.of('2026-10-06'),
        dueDate: PurchaseDate.of('2026-10-20'),
        notes: null,
        currency: sampleCurrency(),
        lines: [
          PurchaseInvoiceLine.of({
            id: PurchaseInvoiceLineId.of('f2222222-1111-4111-8111-222222222222'),
            lineNumber: 1,
            receiptLineId: receiptLineId.value,
            orderLineId: null,
            itemId: ItemRef.of(ITEM_PRODUCT),
            itemSku: 'PRD-01',
            itemName: 'Producto General',
            concept: null,
            unitId: UnitRef.of(UNIT),
            quantity: Quantity.of(10),
            unitPrice: UnitCost.of(12),
            taxRate: TaxRate.of(16),
          }),
        ],
      },
      now,
      today,
    );
    await invoices.save(invoice);

    const match = await matcher.run(TENANT, invId.value);

    expect(match.hasDiscrepancies).toBe(true);
    expect(match.hasQuantityExceeded).toBe(false);
    expect(match.totalPriceDifference).toBe(20); // 10 unidades * 2 de diff
    expect(match.lines[0].priceDifference).toBe(2);
    expect(match.lines[0].priceMismatch).toBe(true);
    expect(match.lines[0].quantityMismatch).toBe(false);
  });

  it('detects quantity exceeding available return quota (H9 §3.9)', async () => {
    const invoices = new InMemoryPurchaseInvoiceRepository();
    const matcher = new ThreeWayMatcher(invoices, mockReceiptsRepo, mockOrdersRepo, mockReturnsRepo);

    // Disponibles 12 (15 - 3 devueltas). Intentamos facturar 14.
    const invId = PurchaseInvoiceId.of('f1111111-1111-4111-8111-333333333333');
    const invoice = PurchaseInvoice.draft(
      invId,
      TenantId.of(TENANT),
      'FCP-000003',
      {
        supplierId: SupplierId.of(SUPPLIER),
        supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-QTY-EXCEEDED'),
        supplierInvoiceSeries: null,
        issueDate: PurchaseDate.of('2026-10-06'),
        dueDate: PurchaseDate.of('2026-10-20'),
        notes: null,
        currency: sampleCurrency(),
        lines: [
          PurchaseInvoiceLine.of({
            id: PurchaseInvoiceLineId.of('f2222222-1111-4111-8111-333333333333'),
            lineNumber: 1,
            receiptLineId: receiptLineId.value,
            orderLineId: null,
            itemId: ItemRef.of(ITEM_PRODUCT),
            itemSku: 'PRD-01',
            itemName: 'Producto General',
            concept: null,
            unitId: UnitRef.of(UNIT),
            quantity: Quantity.of(14),
            unitPrice: UnitCost.of(10),
            taxRate: TaxRate.of(16),
          }),
        ],
      },
      now,
      today,
    );
    await invoices.save(invoice);

    const match = await matcher.run(TENANT, invId.value);

    expect(match.hasDiscrepancies).toBe(true);
    expect(match.hasQuantityExceeded).toBe(true);
    expect(match.lines[0].quantityMismatch).toBe(true);
    expect(match.lines[0].availableQuantity).toBe(12);
    expect(match.lines[0].invoicedQuantity).toBe(14);
  });

  it('matches order direct service line against purchase order', async () => {
    const invoices = new InMemoryPurchaseInvoiceRepository();
    const matcher = new ThreeWayMatcher(invoices, mockReceiptsRepo, mockOrdersRepo, mockReturnsRepo);

    // Servicio directo de orden: pedidos 5 a 50 Bs. Facturamos 3 a 50 Bs.
    const invId = PurchaseInvoiceId.of('f1111111-1111-4111-8111-444444444444');
    const invoice = PurchaseInvoice.draft(
      invId,
      TenantId.of(TENANT),
      'FCP-000004',
      {
        supplierId: SupplierId.of(SUPPLIER),
        supplierInvoiceNumber: SupplierInvoiceNumber.of('FAC-SERVICE-MATCH'),
        supplierInvoiceSeries: null,
        issueDate: PurchaseDate.of('2026-10-06'),
        dueDate: PurchaseDate.of('2026-10-20'),
        notes: null,
        currency: sampleCurrency(),
        lines: [
          PurchaseInvoiceLine.of({
            id: PurchaseInvoiceLineId.of('f2222222-1111-4111-8111-444444444444'),
            lineNumber: 1,
            receiptLineId: null,
            orderLineId: orderLineService.id.value,
            itemId: ItemRef.of(ITEM_SERVICE),
            itemSku: 'SRV-01',
            itemName: 'Transporte',
            concept: null,
            unitId: UnitRef.of(UNIT),
            quantity: Quantity.of(3),
            unitPrice: UnitCost.of(50),
            taxRate: TaxRate.of(16),
          }),
        ],
      },
      now,
      today,
    );
    await invoices.save(invoice);

    const match = await matcher.run(TENANT, invId.value);

    expect(match.hasDiscrepancies).toBe(false);
    expect(match.hasQuantityExceeded).toBe(false);
    expect(match.lines[0].orderLineId).toBe(orderLineService.id.value);
    expect(match.lines[0].orderedQuantity).toBe(5);
    expect(match.lines[0].invoicedQuantity).toBe(3);
    expect(match.lines[0].availableQuantity).toBe(5);
  });
});
