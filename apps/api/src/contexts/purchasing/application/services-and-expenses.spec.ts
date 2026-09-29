import { beforeEach, describe, expect, it } from 'vitest';
import { BusinessCalendar } from '../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { PurchasingCatalog, PurchasableItem } from '../domain/catalog/purchasing-catalog.js';
import {
  InvoiceQuantityExceedsOrderServiceError,
} from '../domain/errors/purchasing.errors.js';
import { PurchaseInvoiceReferences } from '../domain/invoice/lines/purchase-invoice-references.js';
import { PurchasingCodePrefix, PurchasingCodeSequence } from '../domain/shared/code-sequence.js';
import { PurchaseOrder, PurchaseOrderId } from '../domain/order/purchase-order.entity.js';
import { PurchaseOrderLine, PurchaseOrderLineId } from '../domain/order/purchase-order-line.js';
import { PurchaseOrderRepository } from '../domain/order/purchase-order.repository.js';
import { GoodsReceipt, GoodsReceiptId } from '../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../domain/receipt/goods-receipt.repository.js';
import { PurchaseReturn, PurchaseReturnId } from '../domain/return/purchase-return.entity.js';
import { PurchaseReturnRepository } from '../domain/return/purchase-return.repository.js';
import { PurchaseDate } from '../domain/shared/purchase-date.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { Supplier, SupplierId } from '../domain/supplier/supplier.entity.js';
import { SupplierFinder } from '../domain/supplier/find/supplier-finder.js';
import { SupplierRepository } from '../domain/supplier/supplier.repository.js';
import { DocumentCurrency } from '../../../shared/domain/document-currency.js';
import { WarehouseRef, ItemRef, UnitRef } from '../domain/shared/references.vo.js';
import { Quantity } from '../domain/shared/quantity.vo.js';
import { UnitCost, TaxRate } from '../domain/shared/money.js';
import { InMemoryPurchaseInvoiceRepository } from '../infrastructure/testing/in-memory-purchase-invoice.repository.js';
import { InMemoryPurchaseInvoicePosting } from '../infrastructure/testing/in-memory-purchase-invoice-posting.js';
import { PurchaseInvoiceCreator } from './create-invoice/purchase-invoice-creator.js';
import { PurchaseInvoiceConfirmer } from './confirm-invoice/purchase-invoice-confirmer.js';
import { PurchaseInvoiceCanceller } from './cancel-invoice/purchase-invoice-canceller.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SUPPLIER_A = 'e8000000-0000-4000-8000-000000000001';
const ITEM_SERVICE = 'e4000000-0000-4000-8000-000000000005';
const UNIT_BOX = 'e0000000-0000-4000-8000-000000000001';
const WAREHOUSE_ID = 'e3000000-0000-4000-8000-000000000001';

class TestClock implements Clock {
  constructor(private currentDate = new Date('2026-10-10T10:00:00Z')) {}
  now(): Date {
    return this.currentDate;
  }
}

class TestCalendar implements BusinessCalendar {
  async today(_tenantId: string): Promise<string> {
    return '2026-10-10';
  }
}

class TestRates implements DocumentRates {
  async amountDecimals(_tenantId: string): Promise<number> {
    return 2;
  }
  async priceDecimals(_tenantId: string): Promise<number> {
    return 4;
  }
  async companyCurrency(_tenantId: string): Promise<string> {
    return 'USD';
  }
  async rateAt(_tenantId: string, _currency: string, _date: string): Promise<number> {
    return 1;
  }
  async rateFor(_tenantId: string, _currency: string, _date: string): Promise<number> {
    return 1;
  }
  async forDocument(_tenantId: string, options: any): Promise<any> {
    return {
      currency: options.currency ?? 'USD',
      exchangeRate: options.manualRate ?? 1,
      baseCurrency: 'USD',
      baseExchangeRate: 1,
      manualRate: Boolean(options.manualRate),
    };
  }
  async convert(_tenantId: string, amount: number): Promise<number> {
    return amount;
  }
  async convertFromBase(_tenantId: string, amount: number): Promise<number> {
    return amount;
  }
}

class TestIdGenerator implements IdGenerator {
  private seq = 1;
  next(): string {
    const hex = (this.seq++).toString(16).padStart(12, '0');
    return `d0000000-0000-4000-8000-${hex}`;
  }
}

class TestCodeSequence implements PurchasingCodeSequence {
  private counts = new Map<string, number>();
  async next(_tenantId: TenantId, prefix: PurchasingCodePrefix): Promise<number> {
    const count = (this.counts.get(prefix) ?? 0) + 1;
    this.counts.set(prefix, count);
    return count;
  }
}

class TestCatalog implements PurchasingCatalog {
  private items = new Map<string, PurchasableItem>();
  addItem(item: PurchasableItem): void {
    this.items.set(item.id, item);
  }
  async findItems(_tenantId: TenantId, itemIds: { value: string }[]): Promise<PurchasableItem[]> {
    return itemIds.map((id) => this.items.get(id.value)!).filter(Boolean);
  }
  async findWarehouses(): Promise<any[]> {
    return [];
  }
}

class TestSupplierRepository implements SupplierRepository {
  public suppliers = new Map<string, Supplier>();
  async find(_tenantId: TenantId, id: SupplierId): Promise<Supplier | null> {
    return this.suppliers.get(id.value) ?? null;
  }
  async save(supplier: Supplier): Promise<void> {
    this.suppliers.set(supplier.id.value, supplier);
  }
  async findByName(): Promise<Supplier | null> { return null; }
  async searchByTenant(): Promise<Supplier[]> { return [...this.suppliers.values()]; }
  async searchPage(): Promise<any> { return { suppliers: [...this.suppliers.values()], total: this.suppliers.size }; }
  async search(): Promise<{ suppliers: Supplier[]; total: number }> {
    return { suppliers: [...this.suppliers.values()], total: this.suppliers.size };
  }
}

class TestOrderRepository implements PurchaseOrderRepository {
  public orders = new Map<string, PurchaseOrder>();
  async find(_tenantId: TenantId, id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    return this.orders.get(id.value) ?? null;
  }
  async save(order: PurchaseOrder): Promise<void> {
    this.orders.set(order.id.value, order);
  }
  async findByCode(): Promise<PurchaseOrder | null> { return null; }
  async searchByTenant(): Promise<PurchaseOrder[]> { return [...this.orders.values()]; }
  async searchPage(): Promise<any> { return { orders: [...this.orders.values()], total: this.orders.size }; }
  async searchOpen(): Promise<PurchaseOrder[]> { return []; }
  async search(): Promise<{ orders: PurchaseOrder[]; total: number }> {
    return { orders: [...this.orders.values()], total: this.orders.size };
  }
}

class TestReceiptRepository implements GoodsReceiptRepository {
  public receipts = new Map<string, GoodsReceipt>();
  async find(_tenantId: TenantId, id: GoodsReceiptId): Promise<GoodsReceipt | null> {
    return this.receipts.get(id.value) ?? null;
  }
  async save(receipt: GoodsReceipt): Promise<void> {
    this.receipts.set(receipt.id.value, receipt);
  }
  async findByCode(): Promise<GoodsReceipt | null> { return null; }
  async searchByTenant(): Promise<GoodsReceipt[]> { return [...this.receipts.values()]; }
  async searchPage(): Promise<any> { return { receipts: [...this.receipts.values()], total: this.receipts.size }; }
  async search(): Promise<{ receipts: GoodsReceipt[]; total: number }> {
    return { receipts: [...this.receipts.values()], total: this.receipts.size };
  }
}

class TestReturnRepository implements PurchaseReturnRepository {
  public returns = new Map<string, PurchaseReturn>();
  async find(_tenantId: TenantId, id: PurchaseReturnId): Promise<PurchaseReturn | null> {
    return this.returns.get(id.value) ?? null;
  }
  async save(ret: PurchaseReturn): Promise<void> {
    this.returns.set(ret.id.value, ret);
  }
  async findByCode(): Promise<PurchaseReturn | null> { return null; }
  async searchPage(): Promise<any> { return { returns: [...this.returns.values()], total: this.returns.size }; }
  async search(): Promise<{ returns: PurchaseReturn[]; total: number }> {
    return { returns: [...this.returns.values()], total: this.returns.size };
  }
  async returnedQuantitiesByReceipt(): Promise<Map<string, number>> {
    return new Map();
  }
}

describe('Services and Free Expenses Invoicing (H9 §3.6, §4.1, §4.4)', () => {
  let orders: TestOrderRepository;
  let receipts: TestReceiptRepository;
  let returns: TestReturnRepository;
  let invoices: InMemoryPurchaseInvoiceRepository;
  let suppliers: TestSupplierRepository;
  let catalog: TestCatalog;
  let creator: PurchaseInvoiceCreator;
  let confirmer: PurchaseInvoiceConfirmer;
  let canceller: PurchaseInvoiceCanceller;

  let orderId: PurchaseOrderId;
  let serviceLine: PurchaseOrderLine;

  beforeEach(async () => {
    orderId = PurchaseOrderId.of('a1000000-0000-4000-8000-000000000001');
    serviceLine = PurchaseOrderLine.of({
      id: PurchaseOrderLineId.of('a2000000-0000-4000-8000-000000000001'),
      lineNumber: 1,
      itemId: ItemRef.of(ITEM_SERVICE),
      itemSku: 'SRV-TRANSP',
      itemName: 'Servicio de Transporte',
      unitId: UnitRef.of(UNIT_BOX),
      quantity: Quantity.of(4),
      baseQuantity: Quantity.of(4),
      unitCost: UnitCost.of(150),
      taxRate: TaxRate.of(16),
      movesStock: false,
    });

    orders = new TestOrderRepository();
    receipts = new TestReceiptRepository();
    returns = new TestReturnRepository();
    invoices = new InMemoryPurchaseInvoiceRepository();
    suppliers = new TestSupplierRepository();
    catalog = new TestCatalog();

    const supplier = Supplier.fromPrimitives({
      id: SUPPLIER_A,
      tenantId: TENANT,
      code: 'PRV001',
      name: 'Proveedor Logistica C.A.',
      paymentTermDays: 15,
      isActive: true,
      fiscalId: null,
      address: null,
      phone: null,
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await suppliers.save(supplier);

    catalog.addItem({
      id: ITEM_SERVICE,
      sku: 'SRV-TRANSP',
      name: 'Servicio de Transporte',
      type: 'service',
      isActive: true,
      isPurchasable: true,
      taxRate: 16,
      units: [{ unitId: UNIT_BOX, abbreviation: 'bx', conversionFactor: 1, isBase: true, mustBeWhole: true }],
    });

    const clock = new TestClock();
    const calendar = new TestCalendar();
    const rates = new TestRates();
    const ids = new TestIdGenerator();
    const codes = new TestCodeSequence();
    const supplierFinder = new SupplierFinder(suppliers);
    const references = new PurchaseInvoiceReferences(catalog, ids);

    const order = PurchaseOrder.draft(
      orderId,
      TenantId.of(TENANT),
      'OC-0001',
      {
        supplierId: SupplierId.of(SUPPLIER_A),
        warehouseId: WarehouseRef.of(WAREHOUSE_ID),
        orderDate: PurchaseDate.of('2026-10-01'),
        expectedDate: null,
        notes: null,
        paymentTermDays: 15,
        lines: [serviceLine],
        currency: DocumentCurrency.fromPrimitives({
          currency: 'USD',
          exchangeRate: null,
          baseCurrency: 'USD',
          baseExchangeRate: null,
          manualExchangeRate: false,
        }),
      },
      clock.now(),
      '2026-10-10',
    );
    order.confirm(clock.now());
    await orders.save(order);

    creator = new PurchaseInvoiceCreator(
      supplierFinder,
      references,
      invoices,
      codes,
      ids,
      clock,
      calendar,
      rates,
    );

    const posting = new InMemoryPurchaseInvoicePosting(
      invoices,
      receipts,
      orders,
      returns,
    );

    confirmer = new PurchaseInvoiceConfirmer(
      posting,
      clock,
    );

    canceller = new PurchaseInvoiceCanceller(
      posting,
      clock,
    );
  });

  it('confirms a purchase invoice with order service line and updates order invoicedQuantity (H9 §4.1)', async () => {
    // Facturar 2 servicios de los 4 pedidos
    const invoice = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-SRV-101',
      lines: [
        {
          orderLineId: serviceLine.id.value,
          itemId: ITEM_SERVICE,
          unitId: UNIT_BOX,
          quantity: 2,
          unitPrice: 150,
          taxRate: 16,
        },
      ],
    });

    expect(invoice.currentStatus).toBe('draft');
    expect(invoice.totals(2).total).toBe(348); // 300 + 48 tax

    const confirmed = await confirmer.run({ tenantId: TENANT, invoiceId: invoice.id.value });
    expect(confirmed.currentStatus).toBe('confirmed');

    // Verificar que la orden de compra actualizo la cantidad facturada
    const updatedOrder = await orders.find(TenantId.of(TENANT), orderId);
    const srvLine = updatedOrder?.lines().find((l) => l.id.equals(serviceLine.id));
    expect(srvLine?.invoicedQuantity().toNumber()).toBe(2);
  });

  it('rejects invoicing more service quantity than remaining on the purchase order (H9 §4.1)', async () => {
    // Factura 1: toma 3 de los 4 servicios
    const invoice1 = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-SRV-201',
      lines: [
        {
          orderLineId: serviceLine.id.value,
          itemId: ITEM_SERVICE,
          unitId: UNIT_BOX,
          quantity: 3,
          unitPrice: 150,
          taxRate: 16,
        },
      ],
    });
    await confirmer.run({ tenantId: TENANT, invoiceId: invoice1.id.value });

    // Factura 2: intenta facturar 2 mas (3 + 2 = 5 > 4 pedidos) -> rechaza
    const invoice2 = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-SRV-202',
      lines: [
        {
          orderLineId: serviceLine.id.value,
          itemId: ITEM_SERVICE,
          unitId: UNIT_BOX,
          quantity: 2,
          unitPrice: 150,
          taxRate: 16,
        },
      ],
    });

    await expect(
      confirmer.run({ tenantId: TENANT, invoiceId: invoice2.id.value }),
    ).rejects.toThrow(InvoiceQuantityExceedsOrderServiceError);
  });

  it('cancelling a service invoice reverts the invoiced quantity on the purchase order (H9 §4.1)', async () => {
    const invoice = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-SRV-301',
      lines: [
        {
          orderLineId: serviceLine.id.value,
          itemId: ITEM_SERVICE,
          unitId: UNIT_BOX,
          quantity: 4,
          unitPrice: 150,
          taxRate: 16,
        },
      ],
    });

    await confirmer.run({ tenantId: TENANT, invoiceId: invoice.id.value });

    let order = await orders.find(TenantId.of(TENANT), orderId);
    expect(order?.lines()[0].invoicedQuantity().toNumber()).toBe(4);

    await canceller.run({ tenantId: TENANT, invoiceId: invoice.id.value });

    order = await orders.find(TenantId.of(TENANT), orderId);
    expect(order?.lines()[0].invoicedQuantity().toNumber()).toBe(0);
  });

  it('confirms a purchase invoice with direct free expense without order or receipt (H9 §3.6)', async () => {
    const invoiceExpense = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-EXP-500',
      lines: [
        {
          concept: 'Mantenimiento de Servidores Cloud',
          quantity: 1,
          unitPrice: 250,
          taxRate: 16,
        },
      ],
    });

    expect(invoiceExpense.lines()[0].receiptLineId).toBeNull();
    expect(invoiceExpense.lines()[0].orderLineId).toBeNull();
    expect(invoiceExpense.lines()[0].concept).toBe('Mantenimiento de Servidores Cloud');
    expect(invoiceExpense.totals(2).subtotal).toBe(250);
    expect(invoiceExpense.totals(2).tax).toBe(40);
    expect(invoiceExpense.totals(2).total).toBe(290);

    const confirmed = await confirmer.run({ tenantId: TENANT, invoiceId: invoiceExpense.id.value });
    expect(confirmed.currentStatus).toBe('confirmed');
  });

  it('confirms a combined invoice containing both an order service and a free expense (H9 §3.6, §4.1)', async () => {
    const invoiceMixed = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-MIX-700',
      lines: [
        {
          orderLineId: serviceLine.id.value,
          itemId: ITEM_SERVICE,
          unitId: UNIT_BOX,
          quantity: 1,
          unitPrice: 150,
          taxRate: 16,
        },
        {
          concept: 'Comisión por gestión aduanal',
          quantity: 1,
          unitPrice: 80,
          taxRate: 16,
        },
      ],
    });

    expect(invoiceMixed.lines()).toHaveLength(2);
    expect(invoiceMixed.totals(2).subtotal).toBe(230); // 150 + 80
    expect(invoiceMixed.totals(2).tax).toBe(36.8); // 24 + 12.8
    expect(invoiceMixed.totals(2).total).toBe(266.8);

    const confirmed = await confirmer.run({ tenantId: TENANT, invoiceId: invoiceMixed.id.value });
    expect(confirmed.currentStatus).toBe('confirmed');

    const updatedOrder = await orders.find(TenantId.of(TENANT), orderId);
    expect(updatedOrder?.lines()[0].invoicedQuantity().toNumber()).toBe(1);
  });
});

