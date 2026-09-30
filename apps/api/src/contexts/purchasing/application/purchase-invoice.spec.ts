import { describe, expect, it } from 'vitest';
import { Clock } from '../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { DocumentRates } from '../../../shared/domain/ports/document-rates.js';
import { BusinessCalendar } from '../../../shared/domain/ports/business-calendar.js';
import {
  DuplicateSupplierInvoiceNumberError,
  GoodsReceiptHasConfirmedInvoicesError,
  InactiveSupplierError,
  InvoiceLinesFromDifferentSupplierError,
  InvoiceQuantityExceedsOrderServiceError,
  InvoiceQuantityExceedsReceiptError,
  InvoiceReceiptNotConfirmedError,
  PurchaseInvoiceAlreadyCancelledError,
  PurchaseInvoiceNotConfirmableError,
  PurchaseInvoiceNotEditableError,
  PurchaseInvoiceNotFoundError,
  PurchaseInvoiceWithPaymentsError,
} from '../domain/errors/purchasing.errors.js';
import { PurchaseInvoiceReferences } from '../domain/invoice/lines/purchase-invoice-references.js';
import { PurchaseInvoiceId } from '../domain/invoice/purchase-invoice.entity.js';
import { PurchasingCodePrefix, PurchasingCodeSequence } from '../domain/shared/code-sequence.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { Supplier, SupplierId } from '../domain/supplier/supplier.entity.js';
import { SupplierFinder } from '../domain/supplier/find/supplier-finder.js';
import { SupplierRepository } from '../domain/supplier/supplier.repository.js';
import { PurchaseOrder, PurchaseOrderId } from '../domain/order/purchase-order.entity.js';
import { PurchaseOrderLine, PurchaseOrderLineId } from '../domain/order/purchase-order-line.js';
import { PurchaseOrderRepository } from '../domain/order/purchase-order.repository.js';
import { GoodsReceipt, GoodsReceiptId } from '../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptLine, GoodsReceiptLineId } from '../domain/receipt/goods-receipt-line.js';
import { GoodsReceiptRepository } from '../domain/receipt/goods-receipt.repository.js';
import { PurchaseReturn, PurchaseReturnId } from '../domain/return/purchase-return.entity.js';
import { PurchaseReturnLine } from '../domain/return/purchase-return-line.js';
import { PurchaseReturnRepository } from '../domain/return/purchase-return.repository.js';
import { InMemoryPurchaseInvoiceRepository } from '../infrastructure/testing/in-memory-purchase-invoice.repository.js';
import { InMemoryPurchaseInvoicePosting } from '../infrastructure/testing/in-memory-purchase-invoice-posting.js';
import { PurchaseInvoiceCreator } from './create-invoice/purchase-invoice-creator.js';
import { PurchaseInvoiceUpdater } from './update-invoice/purchase-invoice-updater.js';
import { PurchaseInvoiceConfirmer } from './confirm-invoice/purchase-invoice-confirmer.js';
import { PurchaseInvoiceCanceller } from './cancel-invoice/purchase-invoice-canceller.js';
import { PurchaseInvoiceFinder } from './find-invoice/purchase-invoice-finder.js';
import { PurchaseInvoiceSearcher } from './search-invoices/purchase-invoice-searcher.js';
import { GoodsReceiptCanceller } from './cancel-receipt/goods-receipt-canceller.js';
import { ReceiptCancellation } from '../domain/receipt/posting/receipt-cancellation.js';
import { PurchasingCatalog } from '../domain/catalog/purchasing-catalog.js';
import { DocumentCurrency } from '../../../shared/domain/document-currency.js';
import { PurchaseDate } from '../domain/shared/purchase-date.vo.js';
import { WarehouseRef, ItemRef, UnitRef } from '../domain/shared/references.vo.js';
import { Quantity } from '../domain/shared/quantity.vo.js';
import { UnitCost, TaxRate } from '../domain/shared/money.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SUPPLIER_A = 'a1111111-1111-4111-8111-111111111111';
const SUPPLIER_B = 'a2222222-2222-4222-8222-222222222222';
const WAREHOUSE_ID = '01111111-1111-4111-8111-111111111111';
const ITEM_PRODUCT = 'f1111111-1111-4111-8111-111111111111';
const ITEM_SERVICE = 'f2222222-2222-4222-8222-222222222222';
const UNIT_BOX = '03333333-3333-4333-8333-333333333333';

class TestClock implements Clock {
  constructor(public currentDate: Date = new Date('2026-10-10T12:00:00.000Z')) {}
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

  async rateFor(_tenantId: string, _currency: string, _date: string): Promise<number> {
    return 1;
  }

  async forDocument(_tenantId: string, options: any): Promise<any> {
    return {
      currency: options.currency ?? 'USD',
      exchangeRate: options.manualRate ?? null,
      baseCurrency: 'USD',
      baseExchangeRate: null,
      manualExchangeRate: Boolean(options.manualRate),
    };
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
  async findItems(_tenantId: TenantId, ids: ItemRef[]): Promise<any[]> {
    return ids.map((id) => {
      const isService = id.value === ITEM_SERVICE;
      return {
        id: id.value,
        sku: isService ? 'SRV-01' : 'PRD-01',
        name: isService ? 'Servicio Transporte' : 'Producto General',
        type: isService ? 'service' : 'inventoried',
        isActive: true,
        isPurchasable: true,
        taxRate: 16,
        units: [{ unitId: UNIT_BOX, abbreviation: 'bx', conversionFactor: 1, isBase: true, mustBeWhole: true }],
      };
    });
  }

  async findWarehouses(_tenantId: TenantId, ids: WarehouseRef[]): Promise<any[]> {
    return ids.map((id) => ({ id: id.value, name: 'Bodega Principal', isActive: true }));
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
  async returnedQuantitiesByReceipt(_tenantId: TenantId, receiptId: string): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const ret of this.returns.values()) {
      if (ret.receiptId.value === receiptId && ret.currentStatus() === 'confirmed') {
        for (const line of ret.toPrimitives().lines) {
          map.set(line.receiptLineId, (map.get(line.receiptLineId) ?? 0) + line.quantity);
        }
      }
    }
    return map;
  }
}

describe('PurchaseInvoice application services (H9 Fase 1)', () => {
  const clock = new TestClock();
  const calendar = new TestCalendar();
  const rates = new TestRates();
  const ids = new TestIdGenerator();
  const codes = new TestCodeSequence();
  const catalog = new TestCatalog();
  const suppliers = new TestSupplierRepository();
  const supplierFinder = new SupplierFinder(suppliers);
  const references = new PurchaseInvoiceReferences(catalog, ids);
  const invoices = new InMemoryPurchaseInvoiceRepository();
  const orders = new TestOrderRepository();
  const receipts = new TestReceiptRepository();
  const returns = new TestReturnRepository();
  const posting = new InMemoryPurchaseInvoicePosting(invoices, receipts, orders, returns);

  const creator = new PurchaseInvoiceCreator(supplierFinder, references, invoices, codes, ids, clock, calendar, rates);
  const updater = new PurchaseInvoiceUpdater(supplierFinder, references, invoices, clock, calendar, rates);
  const confirmer = new PurchaseInvoiceConfirmer(posting, clock);
  const canceller = new PurchaseInvoiceCanceller(posting, clock);
  const finder = new PurchaseInvoiceFinder(invoices);
  const searcher = new PurchaseInvoiceSearcher(invoices);

  // Sembrar proveedor activo
  const supplierActive = Supplier.create(
    SupplierId.of(SUPPLIER_A),
    TenantId.of(TENANT),
    'PRV-000001',
    {
      name: 'Proveedor Principal',
      email: 'carlos@proveedor.com',
      phone: null,
      address: null,
      paymentTermDays: 30,
    },
    clock.now(),
  );
  suppliers.suppliers.set(SUPPLIER_A, supplierActive);

  // Sembrar orden con mercancia y servicio
  const orderId = PurchaseOrderId.of('b1111111-1111-4111-8111-111111111111');
  const orderLineProduct = PurchaseOrderLine.of({
    id: PurchaseOrderLineId.of('b2222222-2222-4222-8222-111111111111'),
    lineNumber: 1,
    itemId: ItemRef.of(ITEM_PRODUCT),
    itemSku: 'PRD-01',
    itemName: 'Producto General',
    unitId: UnitRef.of(UNIT_BOX),
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
    itemName: 'Servicio Transporte',
    unitId: UnitRef.of(UNIT_BOX),
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
      supplierId: SupplierId.of(SUPPLIER_A),
      warehouseId: WarehouseRef.of(WAREHOUSE_ID),
      orderDate: PurchaseDate.of('2026-10-01'),
      expectedDate: null,
      notes: null,
      paymentTermDays: 30,
      lines: [orderLineProduct, orderLineService],
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
  orders.orders.set(orderId.value, order);

  // Sembrar recepcion confirmada de 15 productos
  const receiptId = GoodsReceiptId.of('e1111111-1111-4111-8111-111111111111');
  const receiptLineId = GoodsReceiptLineId.of('e2222222-2222-4222-8222-111111111111');
  const receiptLine = GoodsReceiptLine.of({
    id: receiptLineId,
    lineNumber: 1,
    orderLineId: orderLineProduct.id,
    itemId: ItemRef.of(ITEM_PRODUCT),
    itemSku: 'PRD-01',
    itemName: 'Producto General',
    unitId: UnitRef.of(UNIT_BOX),
    quantity: Quantity.of(15),
    baseQuantity: Quantity.of(15),
    unitCost: UnitCost.of(10),
  });

  const receipt = GoodsReceipt.draft(
    receiptId,
    TenantId.of(TENANT),
    'ENT-000001',
    { id: orderId, warehouseId: WarehouseRef.of(WAREHOUSE_ID), date: PurchaseDate.of('2026-10-01') },
    {
      date: PurchaseDate.of('2026-10-02'),
      notes: null,
      lines: [receiptLine],
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
  // Confirmar la recepcion
  receipt.confirm(clock.now());
  order.registerReceipt([{ orderLineId: orderLineProduct.id, quantity: Quantity.of(15) }], clock.now());
  receipts.receipts.set(receiptId.value, receipt);

  it('creates draft purchase invoice with correlative FCP and valid totals', async () => {
    const invoice = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: ' fac-9988 ',
      supplierInvoiceSeries: 'A',
      issueDate: '2026-10-05',
      notes: 'Factura inicial',
      lines: [
        {
          receiptLineId: receiptLineId.value,
          itemId: ITEM_PRODUCT,
          unitId: UNIT_BOX,
          quantity: 10,
          unitPrice: 10,
        },
      ],
    });

    expect(invoice.code).toBe('FCP000001');
    expect(invoice.supplierInvoiceNumber.value).toBe('FAC-9988');
    expect(invoice.currentStatus).toBe('draft');
    expect(invoice.dueDate.value).toBe('2026-11-04'); // 30 dias de plazo
  });

  it('rejects duplicate invoice number for the same supplier (H9 §3.1)', async () => {
    await expect(
      creator.run({
        tenantId: TENANT,
        supplierId: SUPPLIER_A,
        supplierInvoiceNumber: 'FAC-9988',
        lines: [
          {
            receiptLineId: receiptLineId.value,
            itemId: ITEM_PRODUCT,
            unitId: UNIT_BOX,
            quantity: 5,
            unitPrice: 10,
          },
        ],
      }),
    ).rejects.toThrow(DuplicateSupplierInvoiceNumberError);
  });

  it('allows same invoice number for a different supplier (H9 §3.1)', async () => {
    const supplierB = Supplier.create(
      SupplierId.of(SUPPLIER_B),
      TenantId.of(TENANT),
      'PRV-000002',
      {
        name: 'Proveedor B',
        email: 'ana@proveedor.com',
        phone: null,
        address: null,
        paymentTermDays: 15,
      },
      clock.now(),
    );
    suppliers.suppliers.set(SUPPLIER_B, supplierB);

    const invoiceB = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_B,
      supplierInvoiceNumber: 'FAC-9988',
      lines: [
        {
          concept: 'Gasto libre de honorarios',
          quantity: 1,
          unitPrice: 100,
        },
      ],
    });

    expect(invoiceB.supplierInvoiceNumber.value).toBe('FAC-9988');
    expect(invoiceB.supplierId.value).toBe(SUPPLIER_B);
  });

  it('confirms invoice and updates order invoicedQuantity (H9 §4.1)', async () => {
    const invoice = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-1001',
      lines: [
        {
          receiptLineId: receiptLineId.value,
          itemId: ITEM_PRODUCT,
          unitId: UNIT_BOX,
          quantity: 10,
          unitPrice: 10,
        },
      ],
    });

    const confirmed = await confirmer.run({ tenantId: TENANT, invoiceId: invoice.id.value });
    expect(confirmed.currentStatus).toBe('confirmed');

    // La orden ahora tiene invoicedQuantity = 10
    const updatedOrder = await orders.find(TenantId.of(TENANT), orderId);
    const line = updatedOrder?.lines().find((l) => l.id.equals(orderLineProduct.id));
    expect(line?.invoicedQuantity().toNumber()).toBe(10);
  });

  it('rejects invoicing more quantity than available in receipt (H9 §3.4, §4.1 regla 3)', async () => {
    // La recepcion tenia 15, ya se facturaron 10, quedan 5 disponibles
    const invoiceExceeding = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-1002',
      lines: [
        {
          receiptLineId: receiptLineId.value,
          itemId: ITEM_PRODUCT,
          unitId: UNIT_BOX,
          quantity: 6, // 6 > 5 disponible
          unitPrice: 10,
        },
      ],
    });

    await expect(
      confirmer.run({ tenantId: TENANT, invoiceId: invoiceExceeding.id.value }),
    ).rejects.toThrow(InvoiceQuantityExceedsReceiptError);
  });

  it('invoicing direct service line marks invoiced and rejects exceeding ordered (H9 §4.1)', async () => {
    // Pedidos 5 servicios
    const invoiceService = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-SRV-01',
      lines: [
        {
          orderLineId: orderLineService.id.value,
          itemId: ITEM_SERVICE,
          unitId: UNIT_BOX,
          quantity: 3,
          unitPrice: 50,
        },
      ],
    });

    await confirmer.run({ tenantId: TENANT, invoiceId: invoiceService.id.value });

    const updatedOrder = await orders.find(TenantId.of(TENANT), orderId);
    const srvLine = updatedOrder?.lines().find((l) => l.id.equals(orderLineService.id));
    expect(srvLine?.invoicedQuantity().toNumber()).toBe(3);

    // Intentar facturar 3 mas (3 + 3 = 6 > 5) se rechaza
    const invoiceExceedingSrv = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-SRV-02',
      lines: [
        {
          orderLineId: orderLineService.id.value,
          itemId: ITEM_SERVICE,
          unitId: UNIT_BOX,
          quantity: 3,
          unitPrice: 50,
        },
      ],
    });

    await expect(
      confirmer.run({ tenantId: TENANT, invoiceId: invoiceExceedingSrv.id.value }),
    ).rejects.toThrow(InvoiceQuantityExceedsOrderServiceError);
  });

  it('confirms invoice of free expense without receipt or order (H9 §3.6)', async () => {
    const invoiceFree = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-EXP-99',
      lines: [
        {
          concept: 'Alquiler de oficina',
          quantity: 1,
          unitPrice: 300,
        },
      ],
    });

    const confirmed = await confirmer.run({ tenantId: TENANT, invoiceId: invoiceFree.id.value });
    expect(confirmed.currentStatus).toBe('confirmed');
  });

  it('cancels confirmed invoice and returns invoiced quantities to order and frees supplier number (H9 §3.1, §4.1)', async () => {
    // Facturar el saldo restante de 5 productos
    const invoice = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-FINAL',
      lines: [
        {
          receiptLineId: receiptLineId.value,
          itemId: ITEM_PRODUCT,
          unitId: UNIT_BOX,
          quantity: 5,
          unitPrice: 10,
        },
      ],
    });

    await confirmer.run({ tenantId: TENANT, invoiceId: invoice.id.value });

    let updatedOrder = await orders.find(TenantId.of(TENANT), orderId);
    let line = updatedOrder?.lines().find((l) => l.id.equals(orderLineProduct.id));
    expect(line?.invoicedQuantity().toNumber()).toBe(15);

    // Anular la factura
    const cancelled = await canceller.run({ tenantId: TENANT, invoiceId: invoice.id.value });
    expect(cancelled.currentStatus).toBe('cancelled');

    // Se devolvieron las cantidades a la orden
    updatedOrder = await orders.find(TenantId.of(TENANT), orderId);
    line = updatedOrder?.lines().find((l) => l.id.equals(orderLineProduct.id));
    expect(line?.invoicedQuantity().toNumber()).toBe(10);

    // El numero FAC-FINAL queda liberado: se puede volver a registrar
    const reissued = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-FINAL',
      lines: [
        {
          receiptLineId: receiptLineId.value,
          itemId: ITEM_PRODUCT,
          unitId: UNIT_BOX,
          quantity: 5,
          unitPrice: 10,
        },
      ],
    });
    expect(reissued.supplierInvoiceNumber.value).toBe('FAC-FINAL');
  });

  it('rejects invoicing goods that were already returned (H9 §3.4)', async () => {
    // Tenemos una entrada nueva de 10 unidades
    const secondReceiptId = GoodsReceiptId.of('e3333333-3333-4333-8333-333333333333');
    const secondReceiptLineId = GoodsReceiptLineId.of('e4444444-4444-4444-8444-444444444444');
    const secondReceiptLine = GoodsReceiptLine.of({
      id: secondReceiptLineId,
      lineNumber: 1,
      orderLineId: orderLineProduct.id,
      itemId: ItemRef.of(ITEM_PRODUCT),
      itemSku: 'PRD-01',
      itemName: 'Producto General',
      unitId: UnitRef.of(UNIT_BOX),
      quantity: Quantity.of(10),
      baseQuantity: Quantity.of(10),
      unitCost: UnitCost.of(10),
    });

    const secondReceipt = GoodsReceipt.draft(
      secondReceiptId,
      TenantId.of(TENANT),
      'ENT-000002',
      { id: orderId, warehouseId: WarehouseRef.of(WAREHOUSE_ID), date: PurchaseDate.of('2026-10-01') },
      {
        date: PurchaseDate.of('2026-10-02'),
        notes: null,
        lines: [secondReceiptLine],
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
    secondReceipt.confirm(clock.now());
    receipts.receipts.set(secondReceiptId.value, secondReceipt);

    // Registramos una devolucion de compra confirmada por 4 unidades
    const returnId = PurchaseReturnId.of('e5555555-5555-4555-8555-555555555555');
    const returnDoc = PurchaseReturn.draft(
      returnId,
      TenantId.of(TENANT),
      'DVC-000001',
      { id: SupplierId.of(SUPPLIER_A) },
      { id: secondReceiptId, warehouseId: WarehouseRef.of(WAREHOUSE_ID), date: secondReceipt.date() },
      secondReceipt.currency(),
      {
        date: PurchaseDate.of('2026-10-05'),
        reason: 'defective',
        notes: null,
        lines: [
          PurchaseReturnLine.of({
            id: { value: 'e6666666-6666-4666-8666-666666666666' } as any,
            lineNumber: 1,
            receiptLineId: secondReceiptLineId.value,
            itemId: ItemRef.of(ITEM_PRODUCT),
            itemSku: 'PRD-01',
            itemName: 'Producto General',
            unitId: UnitRef.of(UNIT_BOX),
            quantity: Quantity.of(4),
            baseQuantity: Quantity.of(4),
            unitCost: UnitCost.of(10),
            restoresMovementId: null,
          }),
        ],
      },
      clock.now(),
      '2026-10-10',
    );
    returnDoc.confirm(clock.now(), new Map([['e6666666-6666-4666-8666-666666666666', 'm1']]));
    returns.returns.set(returnId.value, returnDoc);

    // Quedan 10 - 4 = 6 disponibles. Intentar facturar 7 debe fallar
    const invoiceExceedingReturn = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-RETURN-TEST-1',
      lines: [
        {
          receiptLineId: secondReceiptLineId.value,
          itemId: ITEM_PRODUCT,
          unitId: UNIT_BOX,
          quantity: 7,
          unitPrice: 10,
        },
      ],
    });

    await expect(
      confirmer.run({ tenantId: TENANT, invoiceId: invoiceExceedingReturn.id.value }),
    ).rejects.toThrow(InvoiceQuantityExceedsReceiptError);

    // Facturar 6 debe pasar exitosamente
    const invoiceExactReturn = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-RETURN-TEST-2',
      lines: [
        {
          receiptLineId: secondReceiptLineId.value,
          itemId: ITEM_PRODUCT,
          unitId: UNIT_BOX,
          quantity: 6,
          unitPrice: 10,
        },
      ],
    });

    const confirmed = await confirmer.run({ tenantId: TENANT, invoiceId: invoiceExactReturn.id.value });
    expect(confirmed.currentStatus).toBe('confirmed');
  });

  it('covers two receipts in one invoice, and one receipt split across two invoices (H9 §3.5)', async () => {
    // 1. Una factura cubre dos entradas distintas del mismo proveedor
    const r1Id = GoodsReceiptId.of('f1111111-0000-4000-8000-000000000001');
    const r1LineId = GoodsReceiptLineId.of('f1111111-0000-4000-8000-000000000002');
    const r1Line = GoodsReceiptLine.of({
      id: r1LineId,
      lineNumber: 1,
      orderLineId: orderLineProduct.id,
      itemId: ItemRef.of(ITEM_PRODUCT),
      itemSku: 'PRD-01',
      itemName: 'Producto General',
      unitId: UnitRef.of(UNIT_BOX),
      quantity: Quantity.of(8),
      baseQuantity: Quantity.of(8),
      unitCost: UnitCost.of(10),
    });
    const r1 = GoodsReceipt.draft(
      r1Id,
      TenantId.of(TENANT),
      'ENT-000011',
      { id: orderId, warehouseId: WarehouseRef.of(WAREHOUSE_ID), date: PurchaseDate.of('2026-10-01') },
      {
        date: PurchaseDate.of('2026-10-02'),
        notes: null,
        lines: [r1Line],
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
    r1.confirm(clock.now());
    receipts.receipts.set(r1Id.value, r1);

    const r2Id = GoodsReceiptId.of('f2222222-0000-4000-8000-000000000001');
    const r2LineId = GoodsReceiptLineId.of('f2222222-0000-4000-8000-000000000002');
    const r2Line = GoodsReceiptLine.of({
      id: r2LineId,
      lineNumber: 1,
      orderLineId: orderLineProduct.id,
      itemId: ItemRef.of(ITEM_PRODUCT),
      itemSku: 'PRD-01',
      itemName: 'Producto General',
      unitId: UnitRef.of(UNIT_BOX),
      quantity: Quantity.of(12),
      baseQuantity: Quantity.of(12),
      unitCost: UnitCost.of(10),
    });
    const r2 = GoodsReceipt.draft(
      r2Id,
      TenantId.of(TENANT),
      'ENT-000012',
      { id: orderId, warehouseId: WarehouseRef.of(WAREHOUSE_ID), date: PurchaseDate.of('2026-10-01') },
      {
        date: PurchaseDate.of('2026-10-02'),
        notes: null,
        lines: [r2Line],
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
    r2.confirm(clock.now());
    receipts.receipts.set(r2Id.value, r2);

    const invoiceTwoReceipts = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-TWO-RECEIPTS',
      lines: [
        { receiptLineId: r1LineId.value, itemId: ITEM_PRODUCT, unitId: UNIT_BOX, quantity: 8, unitPrice: 10 },
        { receiptLineId: r2LineId.value, itemId: ITEM_PRODUCT, unitId: UNIT_BOX, quantity: 6, unitPrice: 10 },
      ],
    });

    const confirmedCombo = await confirmer.run({ tenantId: TENANT, invoiceId: invoiceTwoReceipts.id.value });
    expect(confirmedCombo.currentStatus).toBe('confirmed');

    // 2. Una entrada se factura en dos facturas (de la entrada r2 de 12 se facturaron 6, quedan 6)
    const invoiceSecondHalf = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-SPLIT-SECOND-HALF',
      lines: [
        { receiptLineId: r2LineId.value, itemId: ITEM_PRODUCT, unitId: UNIT_BOX, quantity: 6, unitPrice: 10 },
      ],
    });

    const confirmedSecondHalf = await confirmer.run({ tenantId: TENANT, invoiceId: invoiceSecondHalf.id.value });
    expect(confirmedSecondHalf.currentStatus).toBe('confirmed');
  });

  it('rejects cancelling a goods receipt that has confirmed purchase invoices', async () => {
    const rId = GoodsReceiptId.of('d8888888-0000-4000-8000-000000000001');
    const rLineId = GoodsReceiptLineId.of('d8888888-0000-4000-8000-000000000002');
    const rLine = GoodsReceiptLine.of({
      id: rLineId,
      lineNumber: 1,
      orderLineId: orderLineProduct.id,
      itemId: ItemRef.of(ITEM_PRODUCT),
      itemSku: 'PRD-01',
      itemName: 'Producto General',
      unitId: UnitRef.of(UNIT_BOX),
      quantity: Quantity.of(5),
      baseQuantity: Quantity.of(5),
      unitCost: UnitCost.of(10),
    });
    const receipt = GoodsReceipt.draft(
      rId,
      TenantId.of(TENANT),
      'ENT-000099',
      { id: orderId, warehouseId: WarehouseRef.of(WAREHOUSE_ID), date: PurchaseDate.of('2026-10-01') },
      {
        date: PurchaseDate.of('2026-10-02'),
        notes: null,
        lines: [rLine],
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
    receipt.confirm(clock.now());
    receipts.receipts.set(rId.value, receipt);

    const invoice = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-BLOCK-RECEIPT-CANCEL',
      lines: [{ receiptLineId: rLineId.value, itemId: ITEM_PRODUCT, unitId: UNIT_BOX, quantity: 5, unitPrice: 10 }],
    });
    await confirmer.run({ tenantId: TENANT, invoiceId: invoice.id.value });

    const receiptPostingMock = {
      post: async () => {},
    } as any;
    const receiptCanceller = new GoodsReceiptCanceller(
      receiptPostingMock,
      new ReceiptCancellation(),
      invoices,
      receipts,
      clock,
    );

    await expect(
      receiptCanceller.run({ tenantId: TENANT, receiptId: rId.value }),
    ).rejects.toThrow(GoodsReceiptHasConfirmedInvoicesError);
  });

  it('rejects cancelling a purchase invoice that has payments applied', async () => {
    const inv = await creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      supplierInvoiceNumber: 'FAC-WITH-PAYMENTS',
      lines: [
        { concept: 'Gasto operativo', quantity: 1, unitPrice: 100, taxRate: 0 },
      ],
    });
    await confirmer.run({ tenantId: TENANT, invoiceId: inv.id.value });

    posting.registerPayment(inv.id.value);

    await expect(
      canceller.run({ tenantId: TENANT, invoiceId: inv.id.value }),
    ).rejects.toThrow(PurchaseInvoiceWithPaymentsError);
  });
});
