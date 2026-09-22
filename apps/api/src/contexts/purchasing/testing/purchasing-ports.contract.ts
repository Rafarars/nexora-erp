import { ConcurrentModificationError } from '../../../shared/domain/concurrent-modification.error.js';
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
  PurchaseReturnAlreadyCancelledError,
  PurchaseReturnNotConfirmableError,
  PurchaseReturnNotEditableError,
  PurchaseReturnNotFoundError,
  PurchaseReturnSupplierMismatchError,
  QuantityExceedsReceiptReturnQuotaError,
  ReceiptExceedsPendingError,
  ReceiptNotReturnableError,
  ReceivedGoodsAlreadyUsedError,
  ReturnBeforeReceiptError,
} from '../domain/errors/purchasing.errors.js';
import { ensureOrderMatchesCatalog } from '../domain/order/posting/ordered-items-check.js';
import { PurchaseOrderLine } from '../domain/order/purchase-order-line.js';
import { PurchaseOrder, PurchaseOrderId } from '../domain/order/purchase-order.entity.js';
import { GoodsReceiptLine, GoodsReceiptLineId } from '../domain/receipt/goods-receipt-line.js';
import { GoodsReceipt, GoodsReceiptId } from '../domain/receipt/goods-receipt.entity.js';
import { ReceiptCancellation } from '../domain/receipt/posting/receipt-cancellation.js';
import { ReceiptConfirmation } from '../domain/receipt/posting/receipt-confirmation.js';
import { PurchaseReturnLine, PurchaseReturnLineId } from '../domain/return/purchase-return-line.js';
import { PurchaseReturn, PurchaseReturnId } from '../domain/return/purchase-return.entity.js';
import { DocumentCurrency } from '../../../shared/domain/document-currency.js';
import { PurchaseDate } from '../domain/shared/purchase-date.vo.js';
import { Quantity } from '../domain/shared/quantity.vo.js';
import { WarehouseRef } from '../domain/shared/references.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { Supplier, SupplierId } from '../domain/supplier/supplier.entity.js';
import { MAIN, NOW, SUPPLIER, TENANT_A, TENANT_B, TODAY, WATER, aDocumentCurrency, anOrderLine } from '../domain/testing/purchasing.mother.js';
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

    async function confirmedOrder(lines: PurchaseOrderLine[] = [anOrderLine({ quantity: 10, unitCost: 12 })], currency = aDocumentCurrency()): Promise<PurchaseOrder> {
      const id = PurchaseOrderId.of(`0d000000-0000-4000-8000-${next()}`);
      const order = PurchaseOrder.draft(id, tenant, `OC${next().slice(-6)}`, {
        supplierId: SupplierId.of(SUPPLIER),
        warehouseId: WarehouseRef.of(MAIN),
        orderDate: PurchaseDate.of(TODAY),
        expectedDate: null,
        notes: 'contrato',
        paymentTermDays: 30,
        lines,
        currency,
      }, NOW, TODAY);

      await ports.orders.save(order);
      await ports.orderPosting.post(tenant, id, (locked) => locked.confirm(NOW));

      return (await ports.orders.find(tenant, id))!;
    }

    async function draftReceipt(order: PurchaseOrder, quantities: number[], currency = aDocumentCurrency()): Promise<GoodsReceiptId> {
      const id = GoodsReceiptId.of(`0f000000-0000-4000-8000-${next()}`);
      const lines = order.lines().slice(0, quantities.length).map((line, index) => {
        const quantity = Quantity.of(quantities[index]);

        return GoodsReceiptLine.of({
          id: GoodsReceiptLineId.of(`0e000000-0000-4000-8000-${next()}`),
          lineNumber: index + 1,
          orderLineId: line.id,
          itemId: line.itemId,
          itemSku: 'PRUEBA-SKU',
          itemName: 'Articulo de prueba',
          unitId: line.unitId,
          quantity,
          baseQuantity: quantity.times(24),
          unitCost: line.unitCost,
        });
      });

      await ports.receipts.save(GoodsReceipt.draft(id, tenant, `ENT${next().slice(-6)}`, { id: order.id, warehouseId: order.warehouseId(), date: order.orderDate() }, {
        date: PurchaseDate.of(TODAY),
        notes: null,
        lines,
        currency,
      }, NOW, TODAY));

      return id;
    }

    const confirm = (id: GoodsReceiptId) => ports.receiptPosting.post(tenant, id, (r, o) => new ReceiptConfirmation().apply(r, o, NOW));
    const cancel = (id: GoodsReceiptId) => ports.receiptPosting.post(tenant, id, (r, o) => new ReceiptCancellation().apply(r, o, NOW));

    const confirmReturn = (id: PurchaseReturnId) => ports.returnPosting.confirm(tenant, id, NOW);
    const cancelReturn = (id: PurchaseReturnId) => ports.returnPosting.cancel(tenant, id, NOW);

    async function draftReturn(receipt: GoodsReceipt, quantities: number[], date = TODAY, reason = 'defect'): Promise<PurchaseReturnId> {
      const id = PurchaseReturnId.of(`0c000000-0000-4000-8000-${next()}`);
      const lines = receipt.lines().slice(0, quantities.length).map((line, index) => {
        const quantity = Quantity.of(quantities[index]);

        return PurchaseReturnLine.of({
          id: PurchaseReturnLineId.of(`0b000000-0000-4000-8000-${next()}`),
          lineNumber: index + 1,
          receiptLineId: line.id.value,
          itemId: line.itemId,
          itemSku: line.itemSku,
          itemName: line.itemName,
          unitId: line.unitId,
          quantity,
          baseQuantity: quantity.times(24),
          unitCost: line.unitCost,
          restoresMovementId: null,
        });
      });

      await ports.returns.save(
        PurchaseReturn.draft(
          id,
          tenant,
          `DVC${next().slice(-6)}`,
          { id: SupplierId.of(SUPPLIER) },
          { id: receipt.id, warehouseId: receipt.warehouseId, date: receipt.date() },
          receipt.currency(),
          {
            date: PurchaseDate.of(date),
            reason,
            notes: 'Devolucion contrato',
            lines,
          },
          NOW,
          TODAY,
        ),
      );

      return id;
    }

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

      // Buscar sin importar mayusculas es donde el doble y PostgreSQL se separan si nadie mira.
      it('searches by code, name and fiscal id, ignoring case, and pages with a stable order', async () => {
        const other = Supplier.create(
          SupplierId.of('f3333333-3333-4333-8333-333333333333'),
          tenant,
          'PRV900003',
          { name: 'Aguas del Valle', fiscalId: 'J-30512345-6' },
          NOW,
        );
        await ports.suppliers.save(other);
        const criteria = { text: null, isActive: null, limit: 20, offset: 0 };

        expect((await ports.suppliers.searchPage(tenant, { ...criteria, text: 'aguas' })).suppliers.map((s) => s.id.value)).toEqual([other.id.value]);
        expect((await ports.suppliers.searchPage(tenant, { ...criteria, text: 'AGUAS' })).suppliers.map((s) => s.id.value)).toEqual([other.id.value]);
        expect((await ports.suppliers.searchPage(tenant, { ...criteria, text: 'prv900003' })).total).toBe(1);
        // Un proveedor sin identificacion fiscal no puede romper la busqueda por ese campo.
        expect((await ports.suppliers.searchPage(tenant, { ...criteria, text: '30512345' })).total).toBe(1);

        const first = await ports.suppliers.searchPage(tenant, { ...criteria, limit: 1, offset: 0 });
        const second = await ports.suppliers.searchPage(tenant, { ...criteria, limit: 1, offset: 1 });

        expect(first.total).toBe(2);
        expect(first.suppliers[0].id.value).not.toBe(second.suppliers[0].id.value);
      });

      it('tells apart the active from the inactive', async () => {
        const closed = Supplier.create(SupplierId.of('f4444444-4444-4444-8444-444444444444'), tenant, 'PRV900004', { name: 'Cerrado' }, NOW);
        closed.deactivate(NOW);
        await ports.suppliers.save(closed);
        const criteria = { text: null, limit: 20, offset: 0 };

        expect((await ports.suppliers.searchPage(tenant, { ...criteria, isActive: true })).suppliers.map((s) => s.id.value)).toEqual([SUPPLIER]);
        expect((await ports.suppliers.searchPage(tenant, { ...criteria, isActive: false })).suppliers.map((s) => s.id.value)).toEqual([closed.id.value]);
        expect((await ports.suppliers.searchPage(tenant, { ...criteria, isActive: null })).total).toBe(2);
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

      // El update enumera columnas a mano: una que se olvide se escribe bien en el doble y no en
      // la base. Ya paso con el autor del ajuste, y por eso el plazo se comprueba aqui.
      it('stores and reloads the payment term frozen on the order', async () => {
        const order = await confirmedOrder();

        expect((await ports.orders.find(tenant, order.id))?.toPrimitives().paymentTermDays).toBe(30);
      });

      it('keeps the currency and the frozen rates, and a document written before them without rates', async () => {
        const order = await confirmedOrder(undefined, aDocumentCurrency({ currency: 'EUR', exchangeRate: 40.12345678, baseExchangeRate: 36.5, manualRate: true }));
        const legacy = await confirmedOrder(
          undefined,
          DocumentCurrency.fromPrimitives({ currency: 'USD', exchangeRate: null, baseCurrency: 'USD', baseExchangeRate: null, manualExchangeRate: false }),
        );
        const receiptId = await draftReceipt(order, [4], aDocumentCurrency({ currency: 'EUR', exchangeRate: 41, baseExchangeRate: 37 }));

        expect(order.currency().toPrimitives()).toEqual({ currency: 'EUR', exchangeRate: 40.12345678, baseCurrency: 'USD', baseExchangeRate: 36.5, manualExchangeRate: true });
        expect(legacy.currency().toPrimitives()).toMatchObject({ currency: 'USD', exchangeRate: null, baseExchangeRate: null });
        expect((await ports.receipts.find(tenant, receiptId))?.currency().toPrimitives()).toEqual({
          currency: 'EUR',
          exchangeRate: 41,
          baseCurrency: 'USD',
          baseExchangeRate: 37,
          manualExchangeRate: false,
        });
      });

      // Dos personas con el mismo borrador: la segunda que guarda no borra lo que guardo la primera.
      it('refuses to overwrite a draft that someone else saved in the meantime', async () => {
        const id = PurchaseOrderId.of(`0d000000-0000-4000-8000-${next()}`);
        const details = (notes: string) => ({
          supplierId: SupplierId.of(SUPPLIER),
          warehouseId: WarehouseRef.of(MAIN),
          orderDate: PurchaseDate.of(TODAY),
          expectedDate: null,
          paymentTermDays: 30,
          notes,
          lines: [anOrderLine()],
          currency: aDocumentCurrency(),
        });
        await ports.orders.save(PurchaseOrder.draft(id, tenant, `OC${next().slice(-6)}`, details('original'), NOW, TODAY));
        const first = (await ports.orders.find(tenant, id))!;
        const second = (await ports.orders.find(tenant, id))!;

        first.update(details('primero'), new Date(NOW.getTime() + 1000), TODAY);
        await ports.orders.save(first);
        second.update(details('segundo'), new Date(NOW.getTime() + 2000), TODAY);

        await expect(ports.orders.save(second)).rejects.toThrow(ConcurrentModificationError);
        expect((await ports.orders.find(tenant, id))?.notes()).toBe('primero');
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
            paymentTermDays: 30,
            lines: [anOrderLine({ quantity: 10, factor: 12, unitCost: 12 })],
            currency: aDocumentCurrency(),
          }, NOW, TODAY),
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

    describe('PurchaseReturnRepository', () => {
      it('returns what it saved with its lines, and hides it from another tenant', async () => {
        const order = await confirmedOrder();
        const receiptId = await draftReceipt(order, [5]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        const returnId = await draftReturn(receipt, [2]);
        const found = await ports.returns.find(tenant, returnId);

        expect(found?.toPrimitives()).toMatchObject({
          id: returnId.value,
          supplierId: SUPPLIER,
          receiptId: receiptId.value,
          warehouseId: MAIN,
          status: 'draft',
          notes: 'Devolucion contrato',
        });
        expect(found?.lines()).toHaveLength(1);
        expect(found?.lines()[0].quantity.toNumber()).toBe(2);
        expect(await ports.returns.find(TenantId.of(TENANT_B), returnId)).toBeNull();
      });

      it('refuses to overwrite a draft that someone else saved in the meantime', async () => {
        const order = await confirmedOrder();
        const receiptId = await draftReceipt(order, [5]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        const returnId = await draftReturn(receipt, [2]);
        const first = (await ports.returns.find(tenant, returnId))!;
        const second = (await ports.returns.find(tenant, returnId))!;

        first.rewrite(
          {
            date: first.returnDate(),
            reason: null,
            notes: 'primero',
            lines: first.lines(),
          },
          receipt.date(),
          new Date(NOW.getTime() + 1000),
          TODAY,
        );
        await ports.returns.save(first);

        second.rewrite(
          {
            date: second.returnDate(),
            reason: null,
            notes: 'segundo',
            lines: second.lines(),
          },
          receipt.date(),
          new Date(NOW.getTime() + 2000),
          TODAY,
        );
        await expect(ports.returns.save(second)).rejects.toThrow(ConcurrentModificationError);
      });

      it('refuses to overwrite a return that was confirmed in the meantime', async () => {
        const order = await confirmedOrder();
        const receiptId = await draftReceipt(order, [5]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        const returnId = await draftReturn(receipt, [2]);
        const stale = (await ports.returns.find(tenant, returnId))!;
        await confirmReturn(returnId);

        await expect(ports.returns.save(stale)).rejects.toThrow(PurchaseReturnNotEditableError);
      });

      it('searches by criteria and counts confirmed returned quantities', async () => {
        const order = await confirmedOrder();
        const receiptId = await draftReceipt(order, [6]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        const return1 = await draftReturn(receipt, [2]);
        await draftReturn(receipt, [1]);
        await confirmReturn(return1);

        const page = await ports.returns.searchPage(tenant, {
          supplierId: SUPPLIER,
          receiptId: receiptId.value,
          limit: 10,
          offset: 0,
        });

        expect(page.total).toBe(2);
        expect(page.returns).toHaveLength(2);

        const returned = await ports.returns.returnedQuantitiesByReceipt(tenant, receiptId.value);
        const receiptLineId = receipt.lines()[0].id.value;
        expect(returned.get(receiptLineId)).toBe(2);
      });
    });

    describe('PurchaseReturnPosting', () => {
      it('confirms a return: stock decreases and purchase order is untouched (H8 §3.11)', async () => {
        const order = await confirmedOrder([anOrderLine({ quantity: 10, unitCost: 12 })]);
        const receiptId = await draftReceipt(order, [10]);
        await confirm(receiptId);
        expect(await harness.stockOf(WATER, MAIN)).toBe(240);

        const receipt = (await ports.receipts.find(tenant, receiptId))!;
        const returnId = await draftReturn(receipt, [2]);
        const confirmed = await confirmReturn(returnId);

        expect(confirmed.currentStatus()).toBe('confirmed');
        expect(confirmed.lines()[0].restoresMovementId).toBeTruthy();
        expect(await harness.stockOf(WATER, MAIN)).toBe(192);

        // La orden de compra NO se modifica en absoluto (§3.11)
        const refreshedOrder = (await ports.orders.find(tenant, order.id))!;
        expect(refreshedOrder.currentStatus()).toBe('received');
        expect(refreshedOrder.toPrimitives().lines[0].receivedQuantity).toBe(10);
      });

      it('refuses to return more than receipt quantity (quantity quota H8 §3.3)', async () => {
        const order = await confirmedOrder([anOrderLine({ quantity: 10, unitCost: 12 })]);
        const receiptId = await draftReceipt(order, [4]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        const return1 = await draftReturn(receipt, [3]);
        await confirmReturn(return1);

        const return2 = await draftReturn(receipt, [2]);
        await expect(confirmReturn(return2)).rejects.toThrow(QuantityExceedsReceiptReturnQuotaError);
      });

      it('lets only one of two concurrent returns through when both exceed the remaining quota', async () => {
        const order = await confirmedOrder([anOrderLine({ quantity: 10, unitCost: 12 })]);
        const receiptId = await draftReceipt(order, [5]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        const return1 = await draftReturn(receipt, [3]);
        const return2 = await draftReturn(receipt, [3]);

        const results = await Promise.allSettled([confirmReturn(return1), confirmReturn(return2)]);
        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(QuantityExceedsReceiptReturnQuotaError);
      });

      it('refuses to return goods from a receipt of another supplier', async () => {
        const order = await confirmedOrder();
        const receiptId = await draftReceipt(order, [5]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        const otherSupplierId = SupplierId.of(`0a000000-0000-4000-8000-${next()}`);
        await ports.suppliers.save(Supplier.create(otherSupplierId, tenant, `PRV${next().slice(-6)}`, { name: `Otro Proveedor ${next()}` }, NOW));
        const invalidReturn = PurchaseReturn.draft(
          PurchaseReturnId.of(`0c000000-0000-4000-8000-${next()}`),
          tenant,
          `DVC${next().slice(-6)}`,
          { id: otherSupplierId },
          { id: receipt.id, warehouseId: receipt.warehouseId, date: receipt.date() },
          receipt.currency(),
          {
            date: PurchaseDate.of(TODAY),
            reason: 'defect',
            notes: null,
            lines: [
              PurchaseReturnLine.of({
                id: PurchaseReturnLineId.of(`0b000000-0000-4000-8000-${next()}`),
                lineNumber: 1,
                receiptLineId: receipt.lines()[0].id.value,
                itemId: receipt.lines()[0].itemId,
                itemSku: receipt.lines()[0].itemSku,
                itemName: receipt.lines()[0].itemName,
                unitId: receipt.lines()[0].unitId,
                quantity: Quantity.of(1),
                baseQuantity: Quantity.of(24),
                unitCost: receipt.lines()[0].unitCost,
                restoresMovementId: null,
              }),
            ],
          },
          NOW,
          TODAY,
        );
        await ports.returns.save(invalidReturn);

        await expect(confirmReturn(invalidReturn.id)).rejects.toThrow(PurchaseReturnSupplierMismatchError);
      });

      it('refuses to return with a date earlier than the receipt date', async () => {
        const order = await confirmedOrder();
        const receiptId = await draftReceipt(order, [5]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        await expect(draftReturn(receipt, [1], '2020-01-01')).rejects.toThrow(ReturnBeforeReceiptError);
      });

      it('refuses to return if receipt is not confirmed', async () => {
        const order = await confirmedOrder();
        const receiptId = await draftReceipt(order, [5]);
        const draftReceiptDoc = (await ports.receipts.find(tenant, receiptId))!;

        const returnId = await draftReturn(draftReceiptDoc, [1]);
        await expect(confirmReturn(returnId)).rejects.toThrow(ReceiptNotReturnableError);
      });

      it('refuses to return when stock has already been used/withdrawn', async () => {
        const order = await confirmedOrder();
        const receiptId = await draftReceipt(order, [4]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        // Hay 4 cajas * 24 = 96 botellas. Retiramos 80, quedan 16.
        await harness.withdraw(WATER, MAIN, 80);

        // Devolver 1 caja = 24 botellas > 16 disponibles.
        const returnId = await draftReturn(receipt, [1]);
        await expect(confirmReturn(returnId)).rejects.toThrow(ReceivedGoodsAlreadyUsedError);
      });

      it('cancels a confirmed return: goods re-enter stock and status becomes cancelled', async () => {
        const order = await confirmedOrder();
        const receiptId = await draftReceipt(order, [5]);
        await confirm(receiptId);
        const receipt = (await ports.receipts.find(tenant, receiptId))!;

        const returnId = await draftReturn(receipt, [2]);
        await confirmReturn(returnId);
        expect(await harness.stockOf(WATER, MAIN)).toBe(72);

        const cancelled = await cancelReturn(returnId);
        expect(cancelled.currentStatus()).toBe('cancelled');
        expect(await harness.stockOf(WATER, MAIN)).toBe(120);

        await expect(cancelReturn(returnId)).rejects.toThrow(PurchaseReturnAlreadyCancelledError);
      });

      it('recalculates weighted average cost at frozen cost on return, matching valuation (H8 §3.8 and §7)', async () => {
        // Entrada 1: 10 cajas a costo 12 ($120). Stock: 240, costo prom: 12/24 = 0.50
        const order1 = await confirmedOrder([anOrderLine({ quantity: 10, unitCost: 12 })]);
        const receipt1Id = await draftReceipt(order1, [10]);
        await confirm(receipt1Id);
        const receipt1 = (await ports.receipts.find(tenant, receipt1Id))!;

        // Entrada 2: 10 cajas a costo 24 ($240). Stock: 480, valor: $360, costo prom: 360/480 = 0.75
        const order2 = await confirmedOrder([anOrderLine({ quantity: 10, unitCost: 24 })]);
        const receipt2Id = await draftReceipt(order2, [10]);
        await confirm(receipt2Id);

        expect(await harness.stockOf(WATER, MAIN)).toBe(480);
        if (harness.averageCostOf) {
          expect(await harness.averageCostOf(WATER, MAIN)).toBeCloseTo(0.75, 4);
        }

        // Devolucion de 5 cajas de la Entrada 1 (120 botellas al costo congelado de 0.50 = $60)
        // Valor restante = $360 - $60 = $300 para 360 botellas
        // Costo promedio nuevo = 300 / 360 = 0.833333
        const returnId = await draftReturn(receipt1, [5]);
        await confirmReturn(returnId);

        expect(await harness.stockOf(WATER, MAIN)).toBe(360);
        if (harness.averageCostOf) {
          expect(await harness.averageCostOf(WATER, MAIN)).toBeCloseTo(0.833333, 4);
        }
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
