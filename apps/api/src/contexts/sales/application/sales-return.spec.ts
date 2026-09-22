import { describe, expect, it } from 'vitest';
import { Clock } from '../../../shared/domain/ports/clock.js';
import { DocumentCurrency } from '../../../shared/domain/document-currency.js';

import { CustomerId } from '../domain/customer/customer.entity.js';
import { CustomerRepository } from '../domain/customer/customer.repository.js';
import { Dispatch, DispatchId } from '../domain/dispatch/dispatch.entity.js';
import { DispatchRepository } from '../domain/dispatch/dispatch.repository.js';
import {
  DispatchNotFoundError,
  DispatchNotReturnableError,
  InactiveSalesWarehouseError,
  QuantityExceedsDispatchedReturnQuotaError,
  ReturnBeforeDispatchError,
  ReturnCustomerMismatchError,
  SalesReturnAlreadyCancelledError,
  SalesReturnNotConfirmableError,
  SalesReturnNotFoundError,
  SalesReturnWithCreditNoteError,
} from '../domain/errors/sales.errors.js';
import { SalesOrderFinder } from '../domain/order/find/sales-order-finder.js';
import { SalesOrder } from '../domain/order/sales-order.entity.js';
import { SalesReturnCreditedChecker } from '../domain/return/credited/sales-return-credited-checker.js';
import { SalesReturnFinder } from '../domain/return/find/sales-return-finder.js';
import { SalesReturnLineFactory } from '../domain/return/lines/sales-return-line-factory.js';
import { SalesReturnPosting } from '../domain/return/posting/sales-return-posting.js';
import { SalesReturn } from '../domain/return/sales-return.entity.js';
import { SalesReturnRepository } from '../domain/return/sales-return.repository.js';
import { SalesCodeSequence } from '../domain/shared/code-sequence.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { WarehouseRef } from '../domain/shared/references.vo.js';
import { SalesReturnCreator } from './create-return/sales-return-creator.js';
import { SalesReturnUpdater } from './update-return/sales-return-updater.js';
import { SalesReturnConfirmer } from './confirm-return/sales-return-confirmer.js';
import { SalesReturnCanceller } from './cancel-return/sales-return-canceller.js';
import { DispatchReturnQuotaFinder } from './dispatch-return-quota/dispatch-return-quota-finder.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_A = 'c1111111-1111-4111-8111-111111111111';
const CUSTOMER_B = 'c2222222-2222-4222-8222-222222222222';
const WAREHOUSE_MAIN = '01111111-1111-4111-8111-111111111111';
const WAREHOUSE_INACTIVE = '02222222-2222-4222-8222-222222222222';
const ITEM_WATER = 'a1111111-1111-4111-8111-111111111111';
const UNIT_BOX = '03333333-3333-4333-8333-333333333333';
const ORDER_ID = 'b1111111-1111-4111-8111-111111111111';
const ORDER_LINE_ID = 'b2222222-2222-4222-8222-222222222222';
const DISPATCH_ID = 'd1111111-1111-4111-8111-111111111111';
const DISPATCH_LINE_ID = 'd2222222-2222-4222-8222-222222222222';


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

describe('SalesReturn application rules', () => {
  function makeSetup() {
    const clock = new TestClock();
    const calendar = new TestCalendar();
    const returnsMap = new Map<string, SalesReturn>();
    let codeSeq = 1;

    const customers: Partial<CustomerRepository> = {
      find: async (_t, id) => {
        if (id.value === CUSTOMER_A || id.value === CUSTOMER_B) {
          return { id } as any;
        }
        return null;
      },
    };

    const orderRow = {
      id: ORDER_ID,
      tenantId: TENANT,
      code: 'PED-0001',
      customerId: CUSTOMER_A,
      warehouseId: WAREHOUSE_MAIN,
      orderDate: '2026-10-01',
      currency: 'USD',
      exchangeRate: null,
      baseCurrency: 'USD',
      baseExchangeRate: null,
      manualExchangeRate: false,
      notes: null,
      priceListId: null,
      status: 'confirmed' as const,
      confirmedAt: new Date('2026-10-01T10:00:00.000Z'),
      cancelledAt: null,
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      updatedAt: new Date('2026-10-01T10:00:00.000Z'),
      lines: [
        {
          id: ORDER_LINE_ID,
          lineNumber: 1,
          itemId: ITEM_WATER,
          itemSku: 'WAT',
          itemName: 'Water',
          unitId: UNIT_BOX,
          quantity: 10,
          baseQuantity: 10,
          listPrice: 5,
          unitPrice: 5,
          taxRate: 0,
          dispatchedQuantity: 10,
          invoicedQuantity: 0,
          movesStock: true,
        },
      ],
    };

    const orderEntity = SalesOrder.fromPrimitives(orderRow);

    const orders: Partial<SalesOrderFinder> = {
      find: async (_t, id) => {
        if (id.value === orderEntity.id.value) return orderEntity;
        throw new Error('Order not found');
      },
    };

    let dispatchStatus: 'draft' | 'confirmed' | 'cancelled' = 'confirmed';
    const dispatchRow = () => ({
      id: DISPATCH_ID,
      tenantId: TENANT,
      code: 'DSP-0001',
      orderId: orderEntity.id.value,
      warehouseId: WAREHOUSE_MAIN,
      dispatchDate: '2026-10-05',
      notes: null,
      status: dispatchStatus,
      confirmedAt: new Date('2026-10-05T10:00:00.000Z'),
      cancelledAt: null,
      createdAt: new Date('2026-10-05T10:00:00.000Z'),
      updatedAt: new Date('2026-10-05T10:00:00.000Z'),
      lines: [
        {
          id: DISPATCH_LINE_ID,
          lineNumber: 1,
          orderLineId: ORDER_LINE_ID,
          itemId: ITEM_WATER,
          itemSku: 'WAT',
          itemName: 'Water',
          unitId: UNIT_BOX,
          quantity: 10,
          baseQuantity: 10,
        },
      ],
    });

    const dispatches: Partial<DispatchRepository> = {
      find: async (_t, id) => {
        if (id.value === DISPATCH_ID) {
          return Dispatch.fromPrimitives(dispatchRow());
        }
        return null;
      },
    };

    const catalog = {
      findWarehouses: async (_t: any, refs: WarehouseRef[]) => {
        return refs.map((ref) => {
          if (ref.value === WAREHOUSE_INACTIVE) {
            return { id: ref.value, name: 'Inactive', isActive: false };
          }
          return { id: ref.value, name: 'Main', isActive: true };
        });
      },
      findItemOrThrow: async (_t: any, itemId: any) => ({
        id: itemId.value,
        sku: 'WAT',
        name: 'Water',
        stockable: true,
        unitId: UNIT_BOX,
        unitAbbreviation: 'BX',
        units: [{ unitId: UNIT_BOX, factor: 1, barcode: null }],
        salesPrice: null,
      }),
    };

    const returnsRepo: SalesReturnRepository = {
      find: async (_t, id) => returnsMap.get(id.value) ?? null,
      save: async (entity) => {
        returnsMap.set(entity.id.value, entity);
      },
      searchPage: async () => ({ returns: Array.from(returnsMap.values()), total: returnsMap.size }),
      returnedQuantitiesByDispatch: async (_t, dispatchId) => {
        const map = new Map<string, number>();
        for (const ret of returnsMap.values()) {
          if (ret.dispatchId?.value === dispatchId && ret.currentStatus() === 'confirmed') {
            for (const line of ret.lines()) {
              if (line.dispatchLineId) {
                map.set(line.dispatchLineId, (map.get(line.dispatchLineId) ?? 0) + line.quantity.toNumber());
              }
            }
          }
        }
        return map;
      },
    };

    let lineIdCount = 1;
    const lineFactory = new SalesReturnLineFactory(catalog as any, {
      next: () => `00000000-0000-4000-8000-${String(lineIdCount++).padStart(12, '0')}`,
    } as any);

    const codes: SalesCodeSequence = {
      next: async () => codeSeq++,
    };

    let idCount = 1;
    const ids = {
      next: () => `00000000-0000-4000-9000-${String(idCount++).padStart(12, '0')}`,
    };

    let returnIsCredited = false;
    const creditedChecker: SalesReturnCreditedChecker = {
      isCredited: async () => returnIsCredited,
    };

    let inventoryRestoredCount = 0;
    let inventoryReversedCount = 0;

    const posting: SalesReturnPosting = {
      confirm: async (tenantId, returnId, now) => {
        const ret = await returnsRepo.find(tenantId, returnId);
        if (!ret) throw new SalesReturnNotFoundError(returnId.value);
        if (ret.currentStatus() !== 'draft') {
          throw new SalesReturnNotConfirmableError(returnId.value, ret.currentStatus());
        }

        // Valida cupo
        if (ret.dispatchId) {
          const disp = await dispatches.find!(tenantId, ret.dispatchId);
          if (!disp || disp.currentStatus() !== 'confirmed') {
            throw new DispatchNotReturnableError(ret.dispatchId.value, disp?.currentStatus() ?? 'none');
          }
          const already = await returnsRepo.returnedQuantitiesByDispatch(tenantId, disp.id.value);
          for (const line of ret.lines()) {
            if (!line.dispatchLineId) continue;
            const dispLine = disp.lines().find((dl) => dl.id.value === line.dispatchLineId);
            const returned = already.get(line.dispatchLineId) ?? 0;
            const available = dispLine!.quantity.toNumber() - returned;
            if (line.quantity.toNumber() > available) {
              throw new QuantityExceedsDispatchedReturnQuotaError(line.dispatchLineId, available, line.quantity.toNumber());
            }
          }
        }

        ret.confirm(
          ret.lines().map((l) => ({ lineId: l.id.value, unitCost: 3.5, restoresMovementId: 'mov-1' })),
          now,
        );
        await returnsRepo.save(ret);

        if (ret.condition() !== 'scrap') {
          inventoryRestoredCount += ret.lines().length;
        }

        return ret;
      },
      cancel: async (tenantId, returnId, now) => {
        const ret = await returnsRepo.find(tenantId, returnId);
        if (!ret) throw new SalesReturnNotFoundError(returnId.value);
        if (ret.currentStatus() === 'cancelled') {
          throw new SalesReturnAlreadyCancelledError(returnId.value);
        }
        if (await creditedChecker.isCredited(tenantId, returnId)) {
          throw new SalesReturnWithCreditNoteError(returnId.value);
        }

        if (ret.currentStatus() === 'confirmed' && ret.condition() !== 'scrap') {
          inventoryReversedCount += ret.lines().length;
        }

        ret.cancel(now);
        await returnsRepo.save(ret);
        return ret;
      },
    };

    const creator = new SalesReturnCreator(
      customers as any,
      dispatches as any,
      orders as any,
      returnsRepo,
      lineFactory,
      codes,
      ids,
      clock,
      calendar as any,
    );

    const finder = new SalesReturnFinder(returnsRepo);
    const updater = new SalesReturnUpdater(finder, dispatches as any, returnsRepo, lineFactory, clock, calendar as any);
    const confirmer = new SalesReturnConfirmer(posting, clock);
    const canceller = new SalesReturnCanceller(posting, clock);
    const quotaFinder = new DispatchReturnQuotaFinder({ find: async (_t: any, id: any) => dispatches.find!(_t, id)! } as any, returnsRepo);

    return {
      creator,
      updater,
      confirmer,
      canceller,
      quotaFinder,
      returnsRepo,
      orderEntity,
      setDispatchStatus: (st: typeof dispatchStatus) => {
        dispatchStatus = st;
      },
      setReturnIsCredited: (v: boolean) => {
        returnIsCredited = v;
      },
      getRestoredCount: () => inventoryRestoredCount,
      getReversedCount: () => inventoryReversedCount,
    };
  }

  it('rejects a return if dispatch belongs to a different customer', async () => {
    const s = makeSetup();

    await expect(
      s.creator.run({
        tenantId: TENANT,
        customerId: CUSTOMER_B, // El pedido pertenece a CUSTOMER_A
        dispatchId: DISPATCH_ID,
        condition: 'resalable',
        lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 2 }],
      }),
    ).rejects.toThrow(ReturnCustomerMismatchError);
  });

  it('rejects a return if dispatch is not confirmed', async () => {
    const s = makeSetup();
    s.setDispatchStatus('draft');

    await expect(
      s.creator.run({
        tenantId: TENANT,
        customerId: CUSTOMER_A,
        dispatchId: DISPATCH_ID,
        condition: 'resalable',
        lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 2 }],
      }),
    ).rejects.toThrow(DispatchNotReturnableError);
  });

  it('rejects a return if return date is earlier than dispatch date', async () => {
    const s = makeSetup();

    await expect(
      s.creator.run({
        tenantId: TENANT,
        customerId: CUSTOMER_A,
        dispatchId: DISPATCH_ID, // Despacho es de 2026-10-05
        date: '2026-10-04', // Anterior al despacho
        condition: 'resalable',
        lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 2 }],
      }),
    ).rejects.toThrow(ReturnBeforeDispatchError);
  });

  it('rejects a return if warehouse is inactive', async () => {
    // LineFactory con bodega inactiva
    const catalog = {
      findWarehouses: async () => [{ id: WAREHOUSE_INACTIVE, name: 'Inactive WH', isActive: false }],
    };
    const lineFactory = new SalesReturnLineFactory(catalog as any, {
      next: () => '00000000-0000-4000-8000-000000000001',
    } as any);

    await expect(
      lineFactory.lines(
        TenantId.of(TENANT),
        { warehouseId: WarehouseRef.of(WAREHOUSE_INACTIVE), lines: () => [] } as any,
        [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 1 }],
        new Map(),
      ),
    ).rejects.toThrow(InactiveSalesWarehouseError);
  });


  it('does NOT touch the sales order when return is created, confirmed or cancelled (§3.11)', async () => {
    const s = makeSetup();

    const orderBefore = s.orderEntity.toPrimitives();
    const initialDispatched = orderBefore.lines[0].dispatchedQuantity;

    // Crear devolucion
    const returnId = await s.creator.run({
      tenantId: TENANT,
      customerId: CUSTOMER_A,
      dispatchId: DISPATCH_ID,
      condition: 'resalable',
      lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 4 }],
    });

    // Confirmar devolucion
    await s.confirmer.run({ tenantId: TENANT, returnId });

    // Verificar que el pedido no se toco en absoluto
    const orderAfterConfirm = s.orderEntity.toPrimitives();
    expect(orderAfterConfirm.lines[0].dispatchedQuantity).toBe(initialDispatched);
    expect(orderAfterConfirm.status).toBe(orderBefore.status);

    // Anular devolucion
    await s.canceller.run({ tenantId: TENANT, returnId });

    // El pedido sigue exactamente igual
    const orderAfterCancel = s.orderEntity.toPrimitives();
    expect(orderAfterCancel.lines[0].dispatchedQuantity).toBe(initialDispatched);
  });

  it('enforces return quotas: two partial returns succeed, third exceeding quota is rejected', async () => {
    const s = makeSetup();

    // 1ra devolucion parcial: 4 de 10
    const return1Id = await s.creator.run({
      tenantId: TENANT,
      customerId: CUSTOMER_A,
      dispatchId: DISPATCH_ID,
      condition: 'resalable',
      lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 4 }],
    });
    await s.confirmer.run({ tenantId: TENANT, returnId: return1Id });

    // Cupo restante debe ser 6
    const quota1 = await s.quotaFinder.run(TENANT, DISPATCH_ID);
    expect(quota1.lines[0].availableToReturnQuantity).toBe(6);

    // 2da devolucion parcial: 6 de 10
    const return2Id = await s.creator.run({
      tenantId: TENANT,
      customerId: CUSTOMER_A,
      dispatchId: DISPATCH_ID,
      condition: 'resalable',
      lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 6 }],
    });
    await s.confirmer.run({ tenantId: TENANT, returnId: return2Id });

    // Cupo restante debe ser 0
    const quota2 = await s.quotaFinder.run(TENANT, DISPATCH_ID);
    expect(quota2.lines[0].availableToReturnQuantity).toBe(0);

    // 3ra devolucion parcial: 1 de 10 -> Debe ser rechazada por exceder cupo
    await expect(
      s.creator.run({
        tenantId: TENANT,
        customerId: CUSTOMER_A,
        dispatchId: DISPATCH_ID,
        condition: 'resalable',
        lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 1 }],
      }),
    ).rejects.toThrow(QuantityExceedsDispatchedReturnQuotaError);
  });

  it('scrap condition does NOT restore inventory movements (§3.5)', async () => {
    const s = makeSetup();

    const returnId = await s.creator.run({
      tenantId: TENANT,
      customerId: CUSTOMER_A,
      dispatchId: DISPATCH_ID,
      condition: 'scrap',
      lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 3 }],
    });

    await s.confirmer.run({ tenantId: TENANT, returnId });
    expect(s.getRestoredCount()).toBe(0);

    await s.canceller.run({ tenantId: TENANT, returnId });
    expect(s.getReversedCount()).toBe(0);
  });

  it('resalable condition restores inventory movements, and cancelling reverses them', async () => {
    const s = makeSetup();

    const returnId = await s.creator.run({
      tenantId: TENANT,
      customerId: CUSTOMER_A,
      dispatchId: DISPATCH_ID,
      condition: 'resalable',
      lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 3 }],
    });

    await s.confirmer.run({ tenantId: TENANT, returnId });
    expect(s.getRestoredCount()).toBe(1);

    await s.canceller.run({ tenantId: TENANT, returnId });
    expect(s.getReversedCount()).toBe(1);
  });

  it('rejects cancellation of a return with confirmed credit notes', async () => {
    const s = makeSetup();

    const returnId = await s.creator.run({
      tenantId: TENANT,
      customerId: CUSTOMER_A,
      dispatchId: DISPATCH_ID,
      condition: 'resalable',
      lines: [{ dispatchLineId: DISPATCH_LINE_ID, quantity: 3 }],
    });
    await s.confirmer.run({ tenantId: TENANT, returnId });

    s.setReturnIsCredited(true);

    await expect(s.canceller.run({ tenantId: TENANT, returnId })).rejects.toThrow(SalesReturnWithCreditNoteError);
  });
});
