import { describe, expect, it } from 'vitest';
import { CustomerId } from '../customer/customer.entity.js';
import { DispatchId } from '../dispatch/dispatch.entity.js';
import {
  DuplicateSalesReturnLineError,
  EmptySalesReturnError,
  InvalidReturnConditionError,
  ReturnBeforeDispatchError,
  SalesReturnAlreadyCancelledError,
  SalesReturnNotConfirmableError,
  SalesReturnNotEditableError,
} from '../errors/sales.errors.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../shared/references.vo.js';
import { SalesDate } from '../shared/sales-date.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { aDocumentCurrency, CUSTOMER, MAIN, NOW, PIECE, TENANT_A, TODAY, WATER } from '../testing/sales.mother.js';
import { SalesReturnLine, SalesReturnLineId } from './sales-return-line.js';
import { SalesReturn, SalesReturnId } from './sales-return.entity.js';

const line = (dispatchLineId = '00000001-0000-4000-8000-000000000001', quantity = 2) =>
  SalesReturnLine.of({
    id: SalesReturnLineId.of('00000002-0000-4000-8000-000000000001'),
    lineNumber: 1,
    dispatchLineId,
    itemId: ItemRef.of(WATER),
    itemSku: 'AGUA',
    itemName: 'Agua Mineral',
    unitId: UnitRef.of(PIECE),
    quantity: Quantity.of(quantity),
    baseQuantity: Quantity.of(quantity),
  });

describe('SalesReturn entity', () => {
  it('creates a draft sales return and validates lines', () => {
    const returnEntity = SalesReturn.draft(
      SalesReturnId.of('00000000-0000-4000-8000-000000000001'),
      TenantId.of(TENANT_A),
      'DVV000001',
      { id: CustomerId.of(CUSTOMER) },
      { id: DispatchId.of('00000003-0000-4000-8000-000000000001'), warehouseId: WarehouseRef.of(MAIN), date: SalesDate.of('2026-01-10') },
      WarehouseRef.of(MAIN),
      aDocumentCurrency(),
      {
        date: SalesDate.of('2026-01-12'),

        condition: 'resalable',
        reason: 'Empaque roto',
        notes: null,
        lines: [line()],
      },
      NOW,
      TODAY,
    );

    expect(returnEntity.currentStatus()).toBe('draft');
    expect(returnEntity.lines()).toHaveLength(1);
    expect(returnEntity.warehouseId.value).toBe(MAIN);
  });

  it('rejects an empty sales return', () => {
    expect(() =>
      SalesReturn.draft(
        SalesReturnId.of('00000000-0000-4000-8000-000000000001'),
        TenantId.of(TENANT_A),
        'DVV000001',
        { id: CustomerId.of(CUSTOMER) },
        null,
        WarehouseRef.of(MAIN),
        aDocumentCurrency(),
        {
          date: SalesDate.of(TODAY),
          condition: 'resalable',
          reason: null,
          notes: null,
          lines: [],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(EmptySalesReturnError);
  });

  it('rejects invalid condition', () => {
    expect(() =>
      SalesReturn.draft(
        SalesReturnId.of('00000000-0000-4000-8000-000000000001'),
        TenantId.of(TENANT_A),
        'DVV000001',
        { id: CustomerId.of(CUSTOMER) },
        null,
        WarehouseRef.of(MAIN),
        aDocumentCurrency(),
        {
          date: SalesDate.of(TODAY),
          condition: 'invalid' as any,
          reason: null,
          notes: null,
          lines: [line()],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(InvalidReturnConditionError);
  });

  it('rejects return date earlier than dispatch date', () => {
    expect(() =>
      SalesReturn.draft(
        SalesReturnId.of('00000000-0000-4000-8000-000000000001'),
        TenantId.of(TENANT_A),
        'DVV000001',
        { id: CustomerId.of(CUSTOMER) },
        { id: DispatchId.of('00000003-0000-4000-8000-000000000001'), warehouseId: WarehouseRef.of(MAIN), date: SalesDate.of('2026-01-10') },
        WarehouseRef.of(MAIN),
        aDocumentCurrency(),
        {
          date: SalesDate.of('2026-01-08'),

          condition: 'resalable',
          reason: null,
          notes: null,
          lines: [line()],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(ReturnBeforeDispatchError);
  });

  it('rejects duplicate dispatch lines in the same return', () => {
    expect(() =>
      SalesReturn.draft(
        SalesReturnId.of('00000000-0000-4000-8000-000000000001'),
        TenantId.of(TENANT_A),
        'DVV000001',
        { id: CustomerId.of(CUSTOMER) },
        null,
        WarehouseRef.of(MAIN),
        aDocumentCurrency(),
        {
          date: SalesDate.of(TODAY),
          condition: 'resalable',
          reason: null,
          notes: null,
          lines: [line('dl-1', 2), line('dl-1', 1)],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(DuplicateSalesReturnLineError);
  });

  it('confirms a draft return with valuation and transitions to confirmed', () => {
    const returnEntity = SalesReturn.draft(
      SalesReturnId.of('00000000-0000-4000-8000-000000000001'),
      TenantId.of(TENANT_A),
      'DVV000001',
      { id: CustomerId.of(CUSTOMER) },
      null,
      WarehouseRef.of(MAIN),
      aDocumentCurrency(),
      {
        date: SalesDate.of(TODAY),
        condition: 'resalable',
        reason: null,
        notes: null,
        lines: [line()],
      },
      NOW,
      TODAY,
    );

    returnEntity.confirm(
      [{ lineId: '00000002-0000-4000-8000-000000000001', unitCost: 3.5, restoresMovementId: 'mv-01' }],
      NOW,
    );

    expect(returnEntity.currentStatus()).toBe('confirmed');
    expect(returnEntity.lines()[0].unitCost).toBe(3.5);
    expect(returnEntity.lines()[0].restoresMovementId).toBe('mv-01');

    // Intentar confirmar de nuevo o editar lanza error
    expect(() => returnEntity.confirm([], NOW)).toThrow(SalesReturnNotConfirmableError);
    expect(() =>
      returnEntity.update(
        { date: SalesDate.of(TODAY), condition: 'resalable', reason: null, notes: null, lines: [line()] },
        null,
        NOW,
        TODAY,
      ),
    ).toThrow(SalesReturnNotEditableError);
  });

  it('cancelling changes status to cancelled and prevents cancelling twice', () => {
    const returnEntity = SalesReturn.draft(
      SalesReturnId.of('00000000-0000-4000-8000-000000000001'),
      TenantId.of(TENANT_A),
      'DVV000001',
      { id: CustomerId.of(CUSTOMER) },
      null,
      WarehouseRef.of(MAIN),
      aDocumentCurrency(),
      {
        date: SalesDate.of(TODAY),
        condition: 'resalable',
        reason: null,
        notes: null,
        lines: [line()],
      },
      NOW,
      TODAY,
    );

    returnEntity.cancel(NOW);
    expect(returnEntity.currentStatus()).toBe('cancelled');
    expect(() => returnEntity.cancel(NOW)).toThrow(SalesReturnAlreadyCancelledError);
  });

  it('creates and confirms an originless sales return with written unitCost and null restoresMovementId (H8 §4.1 rule 3)', () => {
    const originlessLine = SalesReturnLine.of({
      id: SalesReturnLineId.of('00000002-0000-4000-8000-000000000009'),
      lineNumber: 1,
      dispatchLineId: null,
      itemId: ItemRef.of(WATER),
      itemSku: 'AGUA',
      itemName: 'Agua Mineral',
      unitId: UnitRef.of(PIECE),
      quantity: Quantity.of(3),
      baseQuantity: Quantity.of(3),
      unitCost: 1.75,
      restoresMovementId: null,
    });

    const returnEntity = SalesReturn.draft(
      SalesReturnId.of('00000000-0000-4000-8000-000000000009'),
      TenantId.of(TENANT_A),
      'DVV000009',
      { id: CustomerId.of(CUSTOMER) },
      null,
      WarehouseRef.of(MAIN),
      aDocumentCurrency(),
      {
        date: SalesDate.of(TODAY),
        condition: 'resalable',
        reason: 'Venta antes de tener el sistema',
        notes: null,
        lines: [originlessLine],
      },
      NOW,
      TODAY,
    );

    expect(returnEntity.dispatchId).toBeNull();
    expect(returnEntity.lines()[0].dispatchLineId).toBeNull();
    expect(returnEntity.lines()[0].unitCost).toBe(1.75);
    expect(returnEntity.lines()[0].restoresMovementId).toBeNull();

    // Al confirmar sin despacho, se conserva el costo escrito y restoresMovementId sigue nulo
    returnEntity.confirm([{ lineId: originlessLine.id.value, unitCost: 1.75, restoresMovementId: null }], NOW);

    expect(returnEntity.currentStatus()).toBe('confirmed');
    expect(returnEntity.lines()[0].unitCost).toBe(1.75);
    expect(returnEntity.lines()[0].restoresMovementId).toBeNull();
  });
});

