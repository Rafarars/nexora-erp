import { describe, expect, it } from 'vitest';
import { Clock } from '../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../shared/domain/ports/id-generator.js';
import { Supplier, SupplierId } from '../domain/supplier/supplier.entity.js';
import { SupplierRepository } from '../domain/supplier/supplier.repository.js';
import { SupplierFinder } from '../domain/supplier/find/supplier-finder.js';
import { GoodsReceipt, GoodsReceiptId } from '../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptLine } from '../domain/receipt/goods-receipt-line.js';
import { GoodsReceiptRepository } from '../domain/receipt/goods-receipt.repository.js';
import { GoodsReceiptFinder } from '../domain/receipt/find/goods-receipt-finder.js';
import { PurchaseOrder, PurchaseOrderId } from '../domain/order/purchase-order.entity.js';
import { PurchaseOrderLine } from '../domain/order/purchase-order-line.js';
import { PurchaseOrderRepository } from '../domain/order/purchase-order.repository.js';
import { PurchaseOrderFinder } from '../domain/order/find/purchase-order-finder.js';
import {
  GoodsReceiptNotFoundError,
  InactivePurchaseWarehouseError,
  PurchaseReturnAlreadyCancelledError,
  PurchaseReturnNotConfirmableError,
  PurchaseReturnNotEditableError,
  PurchaseReturnNotFoundError,
  PurchaseReturnSupplierMismatchError,
  QuantityExceedsReceiptReturnQuotaError,
  ReceiptNotReturnableError,
  ReturnBeforeReceiptError,
} from '../domain/errors/purchasing.errors.js';
import { PurchaseReturnFinder } from '../domain/return/find/purchase-return-finder.js';
import { PurchaseReturnLineFactory } from '../domain/return/lines/purchase-return-line-factory.js';
import { PurchaseReturnPosting } from '../domain/return/posting/purchase-return-posting.js';
import { PurchaseReturn, PurchaseReturnId } from '../domain/return/purchase-return.entity.js';
import { PurchaseReturnRepository } from '../domain/return/purchase-return.repository.js';
import { PurchasingCodeSequence } from '../domain/shared/code-sequence.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { PurchaseReturnCreator } from './create-return/purchase-return-creator.js';
import { PurchaseReturnUpdater } from './update-return/purchase-return-updater.js';
import { PurchaseReturnConfirmer } from './confirm-return/purchase-return-confirmer.js';
import { PurchaseReturnCanceller } from './cancel-return/purchase-return-canceller.js';
import { ReceiptReturnQuotaFinder } from './receipt-return-quota/receipt-return-quota-finder.js';
import { PurchasingCatalog } from '../domain/catalog/purchasing-catalog.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SUPPLIER_A = 'a1111111-1111-4111-8111-111111111111';
const SUPPLIER_B = 'a2222222-2222-4222-8222-222222222222';
const WAREHOUSE_MAIN = '01111111-1111-4111-8111-111111111111';
const WAREHOUSE_INACTIVE = '02222222-2222-4222-8222-222222222222';
const ITEM_WATER = 'f1111111-1111-4111-8111-111111111111';
const UNIT_BOX = '03333333-3333-4333-8333-333333333333';
const ORDER_ID = 'b1111111-1111-4111-8111-111111111111';
const ORDER_LINE_ID = 'b2222222-2222-4222-8222-222222222222';
const RECEIPT_ID = 'e1111111-1111-4111-8111-111111111111';
const RECEIPT_LINE_ID = 'e2222222-2222-4222-8222-222222222222';

class TestClock implements Clock {
  constructor(public currentDate: Date = new Date('2026-10-10T12:00:00.000Z')) {}
  now(): Date {
    return this.currentDate;
  }
}

class TestCalendar {
  async today(_tenantId: string): Promise<string> {
    return '2026-10-10';
  }
}

class TestCodeSequence implements PurchasingCodeSequence {
  private counter = 0;
  async next(_tenantId: TenantId, _prefix: string): Promise<number> {
    this.counter += 1;
    return this.counter;
  }
}

function buildScenario() {
  const clock = new TestClock();
  const calendar = new TestCalendar();
  const codes = new TestCodeSequence();
  let idCounter = 0;
  const ids: IdGenerator = {
    next: () => `c1111111-1111-4111-8111-${String(++idCounter).padStart(12, '0')}`,
  };

  const supplierRows = new Map<string, Supplier>();
  const receiptRows = new Map<string, GoodsReceipt>();
  const orderRows = new Map<string, PurchaseOrder>();
  const returnRows = new Map<string, PurchaseReturn>();

  const catalog: PurchasingCatalog = {
    findItems: async (_tenantId, ids) => {
      const idSet = new Set(ids.map((i) => i.value));
      const items = [];
      if (idSet.has(ITEM_WATER)) {
        items.push({
          id: ITEM_WATER,
          sku: 'AGUA-500',
          name: 'Agua 500ml',
          isActive: true,
          isPurchasable: true,
          type: 'inventoried' as const,
          taxRate: 0,
          units: [
            { unitId: UNIT_BOX, abbreviation: 'caja', conversionFactor: 24, isBase: false, mustBeWhole: true },
          ],
        });
      }
      return items;
    },
    findWarehouses: async (_tenantId, ids) => {
      const idSet = new Set(ids.map((w) => w.value));
      const warehouses = [];
      if (idSet.has(WAREHOUSE_MAIN)) {
        warehouses.push({
          id: WAREHOUSE_MAIN,
          name: 'Bodega Principal',
          isActive: true,
        });
      }
      if (idSet.has(WAREHOUSE_INACTIVE)) {
        warehouses.push({
          id: WAREHOUSE_INACTIVE,
          name: 'Bodega Inactiva',
          isActive: false,
        });
      }
      return warehouses;
    },
  };

  const suppliersRepo: SupplierRepository = {
    find: async (_tenantId, id) => supplierRows.get(id.value) ?? null,
    findByName: async () => null,
    save: async (supplier) => {
      supplierRows.set(supplier.id.value, supplier);
    },
    searchByTenant: async () => [...supplierRows.values()],
    searchPage: async () => ({ suppliers: [...supplierRows.values()], total: supplierRows.size }),
  };

  const receiptsRepo: GoodsReceiptRepository = {
    find: async (_tenantId, id) => receiptRows.get(id.value) ?? null,
    save: async (receipt) => {
      receiptRows.set(receipt.id.value, receipt);
    },
    searchByTenant: async () => [...receiptRows.values()],
    searchPage: async () => ({ receipts: [...receiptRows.values()], total: receiptRows.size }),
  };

  const ordersRepo: PurchaseOrderRepository = {
    find: async (_tenantId, id) => orderRows.get(id.value) ?? null,
    save: async (order) => {
      orderRows.set(order.id.value, order);
    },
    searchByTenant: async () => [...orderRows.values()],
    searchPage: async () => ({ orders: [...orderRows.values()], total: orderRows.size }),
    searchOpen: async () => [...orderRows.values()],
  };

  const returnsRepo: PurchaseReturnRepository = {
    find: async (_tenantId, id) => returnRows.get(id.value) ?? null,
    save: async (ret) => {
      returnRows.set(ret.id.value, ret);
    },
    searchPage: async () => ({ returns: [...returnRows.values()], total: returnRows.size }),
    returnedQuantitiesByReceipt: async (_tenantId, receiptId, excludeReturnId) => {
      const map = new Map<string, number>();
      for (const ret of returnRows.values()) {
        if (ret.receiptId.value === receiptId && ret.currentStatus() === 'confirmed' && (!excludeReturnId || ret.id.value !== excludeReturnId)) {
          for (const line of ret.lines()) {
            map.set(line.receiptLineId, (map.get(line.receiptLineId) ?? 0) + line.quantity.toNumber());
          }
        }
      }
      return map;
    },
  };

  const posting: PurchaseReturnPosting = {
    confirm: async (_tenantId, returnId, now) => {
      const ret = returnRows.get(returnId.value);
      if (!ret) throw new PurchaseReturnNotFoundError(returnId.value);
      if (ret.currentStatus() !== 'draft') {
        throw new PurchaseReturnNotConfirmableError(ret.id.value, ret.currentStatus());
      }
      const restoreMap = new Map<string, string>();
      for (const line of ret.lines()) {
        restoreMap.set(line.id.value, `mv-${line.id.value}`);
      }
      ret.confirm(now, restoreMap);
      return ret;
    },
    cancel: async (_tenantId, returnId, now) => {
      const ret = returnRows.get(returnId.value);
      if (!ret) throw new PurchaseReturnNotFoundError(returnId.value);
      if (ret.currentStatus() === 'cancelled') {
        throw new PurchaseReturnAlreadyCancelledError(ret.id.value);
      }
      ret.cancel(now);
      return ret;
    },
  };

  const supplierFinder = new SupplierFinder(suppliersRepo);
  const receiptFinder = new GoodsReceiptFinder(receiptsRepo);
  const lineFactory = new PurchaseReturnLineFactory(catalog, ids);
  const orderFinder = new PurchaseOrderFinder(ordersRepo);
  const returnFinder = new PurchaseReturnFinder(returnsRepo);

  const creator = new PurchaseReturnCreator(
    supplierFinder,
    receiptFinder,
    orderFinder,
    returnsRepo,
    lineFactory,
    codes,
    ids,
    clock,
    calendar,
  );

  const updater = new PurchaseReturnUpdater(
    returnFinder,
    receiptFinder,
    returnsRepo,
    lineFactory,
    clock,
    calendar,
  );

  const confirmer = new PurchaseReturnConfirmer(posting, clock);
  const canceller = new PurchaseReturnCanceller(posting, clock);
  const quotaFinder = new ReceiptReturnQuotaFinder(receiptFinder, returnsRepo);

  const supplierA = Supplier.create(
    SupplierId.of(SUPPLIER_A),
    TenantId.of(TENANT),
    'PRV000001',
    { name: 'Proveedor Principal' },
    new Date('2026-09-01'),
  );
  supplierRows.set(supplierA.id.value, supplierA);

  const supplierB = Supplier.create(
    SupplierId.of(SUPPLIER_B),
    TenantId.of(TENANT),
    'PRV000002',
    { name: 'Proveedor Secundario' },
    new Date('2026-09-01'),
  );
  supplierRows.set(supplierB.id.value, supplierB);

  const orderLine = PurchaseOrderLine.fromPrimitives({
    id: ORDER_LINE_ID,
    lineNumber: 1,
    itemId: ITEM_WATER,
    itemSku: 'AGUA-500',
    itemName: 'Agua 500ml',
    unitId: UNIT_BOX,
    quantity: 10,
    baseQuantity: 240,
    unitCost: 12,
    taxRate: 0,
    movesStock: true,
    receivedQuantity: 10,
  });

  const order = PurchaseOrder.fromPrimitives({
    id: ORDER_ID,
    tenantId: TENANT,
    code: 'OC000001',
    supplierId: SUPPLIER_A,
    warehouseId: WAREHOUSE_MAIN,
    orderDate: '2026-10-01',
    expectedDate: null,
    paymentTermDays: 30,
    notes: 'Orden de prueba',
    currency: 'USD',
    exchangeRate: null,
    baseCurrency: 'USD',
    baseExchangeRate: null,
    manualExchangeRate: false,
    status: 'received',
    confirmedAt: new Date('2026-10-01'),
    cancelledAt: null,
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date('2026-10-01'),
    lines: [orderLine.toPrimitives()],
  });
  orderRows.set(order.id.value, order);

  const receiptLine = GoodsReceiptLine.fromPrimitives({
    id: RECEIPT_LINE_ID,
    lineNumber: 1,
    orderLineId: ORDER_LINE_ID,
    itemId: ITEM_WATER,
    itemSku: 'AGUA-500',
    itemName: 'Agua 500ml',
    unitId: UNIT_BOX,
    quantity: 10,
    baseQuantity: 240,
    unitCost: 12,
  });

  const receipt = GoodsReceipt.fromPrimitives({
    id: RECEIPT_ID,
    tenantId: TENANT,
    code: 'ENT000001',
    orderId: ORDER_ID,
    warehouseId: WAREHOUSE_MAIN,
    receiptDate: '2026-10-02',
    notes: null,
    currency: 'USD',
    exchangeRate: null,
    baseCurrency: 'USD',
    baseExchangeRate: null,
    manualExchangeRate: false,
    status: 'confirmed',
    confirmedAt: new Date('2026-10-02'),
    cancelledAt: null,
    createdAt: new Date('2026-10-02'),
    updatedAt: new Date('2026-10-02'),
    lines: [receiptLine.toPrimitives()],
  });
  receiptRows.set(receipt.id.value, receipt);

  return {
    creator,
    updater,
    confirmer,
    canceller,
    quotaFinder,
    orderRows,
    receiptRows,
    returnRows,
    order,
    receipt,
  };
}

describe('Purchase Return Application', () => {
  it('creates a draft purchase return with code and returns summary', async () => {
    const s = buildScenario();

    const returnId = await s.creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      receiptId: RECEIPT_ID,
      date: '2026-10-05',
      notes: 'Devolución de botellas dañadas',
      lines: [
        {
          receiptLineId: RECEIPT_LINE_ID,
          quantity: 2,
        },
      ],
    });

    const returnDoc = s.returnRows.get(returnId)!;
    expect(returnDoc.code).toBe('DVC000001');
    expect(returnDoc.currentStatus()).toBe('draft');
    expect(returnDoc.lines()).toHaveLength(1);
    expect(returnDoc.lines()[0].quantity.toNumber()).toBe(2);
    expect(returnDoc.lines()[0].baseQuantity.toNumber()).toBe(48);
  });

  it('refuses to create return if goods receipt is not found', async () => {
    const s = buildScenario();

    await expect(
      s.creator.run({
        tenantId: TENANT,
        supplierId: SUPPLIER_A,
        receiptId: '00000000-0000-4000-8000-000000000000',
        date: '2026-10-05',
        notes: null,
        lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 1 }],
      }),
    ).rejects.toThrow(GoodsReceiptNotFoundError);
  });

  it('refuses to create return if receipt is not confirmed', async () => {
    const s = buildScenario();
    const draftReceipt = GoodsReceipt.fromPrimitives({
      ...s.receipt.toPrimitives(),
      id: '00000000-0000-4000-8000-000000000001',
      status: 'draft',
    });
    s.receiptRows.set(draftReceipt.id.value, draftReceipt);

    await expect(
      s.creator.run({
        tenantId: TENANT,
        supplierId: SUPPLIER_A,
        receiptId: draftReceipt.id.value,
        date: '2026-10-05',
        notes: null,
        lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 1 }],
      }),
    ).rejects.toThrow(ReceiptNotReturnableError);
  });

  it('refuses to create return if supplier does not match the purchase order', async () => {
    const s = buildScenario();

    await expect(
      s.creator.run({
        tenantId: TENANT,
        supplierId: SUPPLIER_B,
        receiptId: RECEIPT_ID,
        date: '2026-10-05',
        notes: null,
        lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 1 }],
      }),
    ).rejects.toThrow(PurchaseReturnSupplierMismatchError);
  });

  it('refuses to create return if warehouse is inactive', async () => {
    const s = buildScenario();
    const receiptInactive = GoodsReceipt.fromPrimitives({
      ...s.receipt.toPrimitives(),
      id: '00000000-0000-4000-8000-000000000002',
      warehouseId: WAREHOUSE_INACTIVE,
    });
    s.receiptRows.set(receiptInactive.id.value, receiptInactive);

    await expect(
      s.creator.run({
        tenantId: TENANT,
        supplierId: SUPPLIER_A,
        receiptId: receiptInactive.id.value,
        date: '2026-10-05',
        notes: null,
        lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 1 }],
      }),
    ).rejects.toThrow(InactivePurchaseWarehouseError);
  });

  it('refuses to create return with a date earlier than receipt date', async () => {
    const s = buildScenario();

    await expect(
      s.creator.run({
        tenantId: TENANT,
        supplierId: SUPPLIER_A,
        receiptId: RECEIPT_ID,
        date: '2026-10-01', // receipt is 2026-10-02
        notes: null,
        lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 1 }],
      }),
    ).rejects.toThrow(ReturnBeforeReceiptError);
  });

  it('refuses to return more than receipt return quota', async () => {
    const s = buildScenario();

    await expect(
      s.creator.run({
        tenantId: TENANT,
        supplierId: SUPPLIER_A,
        receiptId: RECEIPT_ID,
        date: '2026-10-05',
        notes: null,
        lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 15 }], // only 10 received
      }),
    ).rejects.toThrow(QuantityExceedsReceiptReturnQuotaError);
  });

  it('confirms a purchase return and preserves purchase order received quantity (H8 §3.11)', async () => {
    const s = buildScenario();

    const returnId = await s.creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      receiptId: RECEIPT_ID,
      date: '2026-10-05',
      notes: null,
      lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 4 }],
    });

    const confirmed = await s.confirmer.run({
      tenantId: TENANT,
      returnId,
    });

    expect(confirmed.currentStatus()).toBe('confirmed');

    // Purchase order remains intact (§3.11)
    const order = s.orderRows.get(ORDER_ID)!;
    expect(order.currentStatus()).toBe('received');
    expect(order.toPrimitives().lines[0].receivedQuantity).toBe(10);
  });

  it('cancels a purchase return', async () => {
    const s = buildScenario();

    const returnId = await s.creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      receiptId: RECEIPT_ID,
      date: '2026-10-05',
      notes: null,
      lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 2 }],
    });

    await s.confirmer.run({ tenantId: TENANT, returnId });

    const cancelled = await s.canceller.run({
      tenantId: TENANT,
      returnId,
    });

    expect(cancelled.currentStatus()).toBe('cancelled');

    await expect(s.canceller.run({ tenantId: TENANT, returnId })).rejects.toThrow(
      PurchaseReturnAlreadyCancelledError,
    );
  });

  it('updates a draft return with new lines', async () => {
    const s = buildScenario();

    const returnId = await s.creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      receiptId: RECEIPT_ID,
      date: '2026-10-05',
      notes: 'Nota original',
      lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 2 }],
    });

    await s.updater.run({
      tenantId: TENANT,
      returnId,
      date: '2026-10-06',
      reason: 'excess',
      notes: 'Nota editada',
      lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 5 }],
    });

    const updated = s.returnRows.get(returnId)!;
    expect(updated.returnDate().value).toBe('2026-10-06');
    expect(updated.reason()).toBe('excess');
    expect(updated.notes()).toBe('Nota editada');
    expect(updated.lines()[0].quantity.toNumber()).toBe(5);
  });

  it('refuses to update a confirmed return', async () => {
    const s = buildScenario();

    const returnId = await s.creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      receiptId: RECEIPT_ID,
      date: '2026-10-05',
      notes: null,
      lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 2 }],
    });

    await s.confirmer.run({ tenantId: TENANT, returnId });

    await expect(
      s.updater.run({
        tenantId: TENANT,
        returnId,
        date: '2026-10-06',
        notes: null,
        lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 3 }],
      }),
    ).rejects.toThrow(PurchaseReturnNotEditableError);
  });

  it('calculates available return quota taking into account previous confirmed returns', async () => {
    const s = buildScenario();

    // Initial quota: 10
    const initialQuota = await s.quotaFinder.run(TENANT, RECEIPT_ID);
    expect(initialQuota.lines[0].receivedQuantity).toBe(10);
    expect(initialQuota.lines[0].alreadyReturnedQuantity).toBe(0);
    expect(initialQuota.lines[0].availableToReturnQuantity).toBe(10);

    // Return 3
    const returnId = await s.creator.run({
      tenantId: TENANT,
      supplierId: SUPPLIER_A,
      receiptId: RECEIPT_ID,
      date: '2026-10-05',
      notes: null,
      lines: [{ receiptLineId: RECEIPT_LINE_ID, quantity: 3 }],
    });
    await s.confirmer.run({ tenantId: TENANT, returnId });

    // Quota after return 1
    const quotaAfter = await s.quotaFinder.run(TENANT, RECEIPT_ID);
    expect(quotaAfter.lines[0].alreadyReturnedQuantity).toBe(3);
    expect(quotaAfter.lines[0].availableToReturnQuantity).toBe(7);
  });
});
