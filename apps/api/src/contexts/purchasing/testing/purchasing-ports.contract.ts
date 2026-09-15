import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DuplicateSupplierNameError,
  GoodsReceiptAlreadyCancelledError,
  GoodsReceiptNotEditableError,
  GoodsReceiptNotFoundError,
  PurchaseItemChangedError,
  PurchaseOrderNotEditableError,
  PurchaseOrderNotFoundError,
  PurchaseOrderWithReceiptsError,
  ReceiptExceedsPendingError,
  ReceivedGoodsAlreadyUsedError,
} from '../domain/errors/purchasing.errors.js';
import { ensureOrderMatchesCatalog } from '../domain/order/posting/ordered-items-check.js';
import { PurchaseOrderLine } from '../domain/order/purchase-order-line.js';
import { PurchaseOrder, PurchaseOrderId } from '../domain/order/purchase-order.entity.js';
import { GoodsReceiptLine, GoodsReceiptLineId } from '../domain/receipt/goods-receipt-line.js';
import { GoodsReceipt, GoodsReceiptId } from '../domain/receipt/goods-receipt.entity.js';
import { ReceiptCancellation } from '../domain/receipt/posting/receipt-cancellation.js';
import { ReceiptConfirmation } from '../domain/receipt/posting/receipt-confirmation.js';
import { PurchaseDate } from '../domain/shared/purchase-date.vo.js';
import { Quantity } from '../domain/shared/quantity.vo.js';
import { WarehouseRef } from '../domain/shared/references.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { Supplier, SupplierId } from '../domain/supplier/supplier.entity.js';
import { MAIN, NOW, SUPPLIER, TENANT_A, TENANT_B, TODAY, WATER, anOrderLine } from '../domain/testing/purchasing.mother.js';
import { PurchasingPorts, PurchasingPortsHarness } from './purchasing-ports.harness.js';

const tenant = TenantId.of(TENANT_A);

// UNA suite para el doble y para PostgreSQL. Lo que mas importa no es guardar y leer: es que
// entre dos entradas simultaneas nunca entre mas de lo pedido, y que entrada, orden y
// existencia cambien juntas o no cambie ninguna.
export function describePurchasingPortsContract(implementation: string, createHarness: () => PurchasingPortsHarness): void {
  describe(`Purchasing ports contract: ${implementation}`, () => {
    const harness = createHarness();
    let ports: PurchasingPorts;
    let counter = 0;

    beforeEach(async () => {
      await harness.reset();
      ports = harness.ports();
      await ports.suppliers.save(Supplier.create(SupplierId.of(SUPPLIER), tenant, 'PRV900001', { name: 'Contrato proveedor' }, NOW));
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    const next = () => String((counter += 1)).padStart(12, '0');

    async function confirmedOrder(lines: PurchaseOrderLine[] = [anOrderLine({ quantity: 10, unitCost: 12 })]): Promise<PurchaseOrder> {
      const id = PurchaseOrderId.of(`0d000000-0000-4000-8000-${next()}`);
      const order = PurchaseOrder.draft(id, tenant, `OC${next().slice(-6)}`, {
        supplierId: SupplierId.of(SUPPLIER),
        warehouseId: WarehouseRef.of(MAIN),
        orderDate: PurchaseDate.of(TODAY),
        expectedDate: null,
        notes: 'contrato',
        lines,
      }, NOW);

      await ports.orders.save(order);
      await ports.orderPosting.post(tenant, id, (locked) => locked.confirm(NOW));

      return (await ports.orders.find(tenant, id))!;
    }

    async function draftReceipt(order: PurchaseOrder, quantities: number[]): Promise<GoodsReceiptId> {
      const id = GoodsReceiptId.of(`0f000000-0000-4000-8000-${next()}`);
      const lines = order.lines().slice(0, quantities.length).map((line, index) => {
        const quantity = Quantity.of(quantities[index]);

        return GoodsReceiptLine.of({
          id: GoodsReceiptLineId.of(`0e000000-0000-4000-8000-${next()}`),
          lineNumber: index + 1,
          orderLineId: line.id,
          itemId: line.itemId,
          unitId: line.unitId,
          quantity,
          baseQuantity: quantity.times(24),
          unitCost: line.unitCost,
        });
      });

      await ports.receipts.save(GoodsReceipt.draft(id, tenant, `ENT${next().slice(-6)}`, { id: order.id, warehouseId: order.warehouseId() }, {
        date: PurchaseDate.of(TODAY),
        notes: null,
        lines,
      }, NOW));

      return id;
    }

    const confirm = (id: GoodsReceiptId) => ports.receiptPosting.post(tenant, id, (r, o) => new ReceiptConfirmation().apply(r, o, NOW));
    const cancel = (id: GoodsReceiptId) => ports.receiptPosting.post(tenant, id, (r, o) => new ReceiptCancellation().apply(r, o, NOW));

    describe('SupplierRepository', () => {
      it('returns what it saved and hides it from another tenant', async () => {
        const found = await ports.suppliers.find(tenant, SupplierId.of(SUPPLIER));

        expect(found?.toPrimitives()).toMatchObject({ code: 'PRV900001', name: 'Contrato proveedor', paymentTermDays: 0, isActive: true });
        expect(await ports.suppliers.find(TenantId.of(TENANT_B), SupplierId.of(SUPPLIER))).toBeNull();
        expect((await ports.suppliers.findByName(tenant, 'Contrato proveedor'))?.id.value).toBe(SUPPLIER);
      });

      // La base tiene la ultima palabra cuando dos altas pasan a la vez la comprobacion previa.
      it('rejects a second supplier with the same name in the tenant', async () => {
        const clash = Supplier.create(SupplierId.of('f2222222-2222-4222-8222-222222222222'), tenant, 'PRV900002', { name: 'Contrato proveedor' }, NOW);

        await expect(ports.suppliers.save(clash)).rejects.toThrow(DuplicateSupplierNameError);
      });
    });

    describe('PurchaseOrderRepository', () => {
      it('returns the order with its lines, dates and received quantities', async () => {
        const order = await confirmedOrder([anOrderLine({ quantity: 3.5, unitCost: 1.234567, taxRate: 12.5 })]);

        expect(order.toPrimitives()).toMatchObject({
          status: 'confirmed',
          orderDate: TODAY,
          expectedDate: null,
          lines: [{ quantity: 3.5, baseQuantity: 84, unitCost: 1.234567, taxRate: 12.5, receivedQuantity: 0 }],
        });
        expect(await ports.orders.find(TenantId.of(TENANT_B), order.id)).toBeNull();
      });

      it('refuses to overwrite an order that was confirmed in the meantime', async () => {
        const order = await confirmedOrder();
        const stale = PurchaseOrder.fromPrimitives({ ...order.toPrimitives(), status: 'draft' });

        await expect(ports.orders.save(stale)).rejects.toThrow(PurchaseOrderNotEditableError);
      });

      // Con los articulos bloqueados se ve la caja de hoy: 10 cajas anotadas como 120 no se anuncian.
      it('refuses to confirm base quantities that no longer match the unit of the item', async () => {
        const id = PurchaseOrderId.of(`0d000000-0000-4000-8000-${next()}`);

        await ports.orders.save(
          PurchaseOrder.draft(id, tenant, `OC${next().slice(-6)}`, {
            supplierId: SupplierId.of(SUPPLIER),
            warehouseId: WarehouseRef.of(MAIN),
            orderDate: PurchaseDate.of(TODAY),
            expectedDate: null,
            notes: 'contrato',
            lines: [anOrderLine({ quantity: 10, factor: 12, unitCost: 12 })],
          }, NOW),
        );

        await expect(
          ports.orderPosting.post(tenant, id, (locked, items) => {
            ensureOrderMatchesCatalog(locked, items);
            locked.confirm(NOW);
          }),
        ).rejects.toThrow(PurchaseItemChangedError);
        expect((await ports.orders.find(tenant, id))?.currentStatus()).toBe('draft');
      });

      it('answers not found when posting an order of another tenant', async () => {
        const order = await confirmedOrder();

        await expect(ports.orderPosting.post(TenantId.of(TENANT_B), order.id, (o) => o.cancel(NOW))).rejects.toThrow(PurchaseOrderNotFoundError);
      });
    });

    describe('ReceiptPosting', () => {
      it('confirms: receipt, order and stock change together', async () => {
        const order = await confirmedOrder();
        const id = await draftReceipt(order, [4]);

        await confirm(id);

        expect((await ports.receipts.find(tenant, id))?.currentStatus()).toBe('confirmed');
        expect((await ports.orders.find(tenant, order.id))?.toPrimitives()).toMatchObject({ status: 'partially_received', lines: [{ receivedQuantity: 4 }] });
        expect(await harness.stockOf(WATER, MAIN)).toBe(96);
      });

      it('writes nothing at all when the order no longer has that much pending', async () => {
        const order = await confirmedOrder();
        const first = await draftReceipt(order, [7]);
        const second = await draftReceipt(order, [4]);
        await confirm(first);

        await expect(confirm(second)).rejects.toThrow(ReceiptExceedsPendingError);

        expect((await ports.receipts.find(tenant, second))?.currentStatus()).toBe('draft');
        expect((await ports.orders.find(tenant, order.id))?.toPrimitives().lines[0].receivedQuantity).toBe(7);
        expect(await harness.stockOf(WATER, MAIN)).toBe(168);
      });

      // La guarda de la recepcion bajo concurrencia real: dos entradas de 6 sobre 10.
      it('lets only one of two concurrent receipts through when both do not fit', async () => {
        const order = await confirmedOrder();
        const first = await draftReceipt(order, [6]);
        const second = await draftReceipt(order, [6]);

        const results = await Promise.allSettled([confirm(first), confirm(second)]);

        expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ReceiptExceedsPendingError);
        expect((await ports.orders.find(tenant, order.id))?.toPrimitives().lines[0].receivedQuantity).toBe(6);
        expect(await harness.stockOf(WATER, MAIN)).toBe(144);
      });

      it('confirms a receipt only once when asked twice at the same time', async () => {
        const order = await confirmedOrder();
        const id = await draftReceipt(order, [2]);

        const results = await Promise.allSettled([confirm(id), confirm(id)]);

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(await harness.stockOf(WATER, MAIN)).toBe(48);
      });

      // Anular la orden mientras una entrada la recibe: una de las dos pierde, nunca las dos ganan.
      it('never cancels an order that a concurrent receipt is receiving', async () => {
        const order = await confirmedOrder();
        const id = await draftReceipt(order, [1]);

        const [received, cancelled] = await Promise.allSettled([
          confirm(id),
          ports.orderPosting.post(tenant, order.id, (o) => o.cancel(NOW)),
        ]);
        const status = (await ports.orders.find(tenant, order.id))?.currentStatus();

        if (received.status === 'fulfilled') {
          expect(cancelled.status === 'rejected' && cancelled.reason).toBeInstanceOf(PurchaseOrderWithReceiptsError);
          expect(status).toBe('partially_received');
        } else {
          expect(status).toBe('cancelled');
          expect(await harness.stockOf(WATER, MAIN)).toBe(0);
        }
      });

      it('cancels a confirmed receipt: the order steps back and the stock goes out', async () => {
        const order = await confirmedOrder();
        const id = await draftReceipt(order, [10]);
        await confirm(id);
        expect((await ports.orders.find(tenant, order.id))?.currentStatus()).toBe('received');

        await cancel(id);

        expect((await ports.receipts.find(tenant, id))?.currentStatus()).toBe('cancelled');
        expect((await ports.orders.find(tenant, order.id))?.toPrimitives()).toMatchObject({ status: 'confirmed', lines: [{ receivedQuantity: 0 }] });
        expect(await harness.stockOf(WATER, MAIN)).toBe(0);
        await expect(cancel(id)).rejects.toThrow(GoodsReceiptAlreadyCancelledError);
      });

      it('refuses to cancel a receipt whose goods already left, and changes nothing', async () => {
        const order = await confirmedOrder();
        const id = await draftReceipt(order, [4]);
        await confirm(id);
        await harness.withdraw(WATER, MAIN, 50);

        await expect(cancel(id)).rejects.toThrow(ReceivedGoodsAlreadyUsedError);

        expect((await ports.receipts.find(tenant, id))?.currentStatus()).toBe('confirmed');
        expect((await ports.orders.find(tenant, order.id))?.currentStatus()).toBe('partially_received');
        expect(await harness.stockOf(WATER, MAIN)).toBe(46);
      });

      it('refuses to overwrite a receipt confirmed in the meantime, and hides it from another tenant', async () => {
        const order = await confirmedOrder();
        const id = await draftReceipt(order, [1]);
        const stale = (await ports.receipts.find(tenant, id))!;
        await confirm(id);

        await expect(ports.receipts.save(stale)).rejects.toThrow(GoodsReceiptNotEditableError);
        await expect(ports.receiptPosting.post(TenantId.of(TENANT_B), id, (r, o) => new ReceiptConfirmation().apply(r, o, NOW))).rejects.toThrow(
          GoodsReceiptNotFoundError,
        );
        expect((await ports.receipts.searchByTenant(tenant, order.id)).map((r) => r.id.value)).toEqual([id.value]);
      });
    });

    describe('PurchasingCodeSequence', () => {
      it('counts each prefix per tenant', async () => {
        expect(await ports.codes.next(tenant, 'OC')).toBe(1);
        expect(await ports.codes.next(tenant, 'OC')).toBe(2);
        expect(await ports.codes.next(tenant, 'ENT')).toBe(1);
        expect(await ports.codes.next(TenantId.of(TENANT_B), 'OC')).toBe(1);
      });
    });
  });
}
