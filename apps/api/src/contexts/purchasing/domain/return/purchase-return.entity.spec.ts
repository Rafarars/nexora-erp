import { describe, expect, it } from 'vitest';
import { GoodsReceiptId } from '../receipt/goods-receipt.entity.js';
import {
  DuplicatePurchaseReturnLineError,
  EmptyPurchaseReturnError,
  PurchaseReturnAlreadyCancelledError,
  PurchaseReturnNotConfirmableError,
  PurchaseReturnNotEditableError,
  ReturnBeforeReceiptError,
} from '../errors/purchasing.errors.js';
import { UnitCost } from '../shared/money.js';
import { PurchaseDate } from '../shared/purchase-date.vo.js';
import { Quantity } from '../shared/quantity.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../shared/references.vo.js';
import { SupplierId } from '../supplier/supplier.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { MAIN, NOW, PIECE, SUPPLIER, TENANT_A, TODAY, WATER } from '../testing/purchasing.mother.js';
import { PurchaseReturnLine, PurchaseReturnLineId } from './purchase-return-line.js';
import { PurchaseReturn, PurchaseReturnId } from './purchase-return.entity.js';

const line = (receiptLineId = '00000001-0000-4000-8000-000000000001', quantity = 2) =>
  PurchaseReturnLine.of({
    id: PurchaseReturnLineId.of('00000002-0000-4000-8000-000000000001'),
    lineNumber: 1,
    receiptLineId,
    itemId: ItemRef.of(WATER),
    itemSku: 'AGUA',
    itemName: 'Agua Mineral',
    unitId: UnitRef.of(PIECE),
    quantity: Quantity.of(quantity),
    baseQuantity: Quantity.of(quantity),
    unitCost: UnitCost.of(1.5),
  });

const defaultCurrency = DocumentCurrency.fromPrimitives({
  currency: 'USD',
  exchangeRate: null,
  baseCurrency: 'USD',
  baseExchangeRate: null,
  manualExchangeRate: false,
});

describe('PurchaseReturn entity', () => {
  it('creates a draft purchase return and validates lines', () => {
    const returnDoc = PurchaseReturn.draft(
      PurchaseReturnId.of('00000000-0000-4000-8000-000000000001'),
      TenantId.of(TENANT_A),
      'DVC-0001',
      { id: SupplierId.of(SUPPLIER) },
      { id: GoodsReceiptId.of('00000003-0000-4000-8000-000000000001'), warehouseId: WarehouseRef.of(MAIN), date: PurchaseDate.of('2026-01-10') },
      defaultCurrency,
      {
        date: PurchaseDate.of('2026-01-12'),
        reason: 'Defectuoso',
        notes: null,
        lines: [line()],
      },
      NOW,
      TODAY,
    );

    expect(returnDoc.currentStatus()).toBe('draft');
    expect(returnDoc.lines()).toHaveLength(1);
    expect(returnDoc.warehouseId.value).toBe(MAIN);
  });

  it('rejects a return with a date before the goods receipt date', () => {
    expect(() =>
      PurchaseReturn.draft(
        PurchaseReturnId.of('00000000-0000-4000-8000-000000000001'),
        TenantId.of(TENANT_A),
        'DVC-0001',
        { id: SupplierId.of(SUPPLIER) },
        { id: GoodsReceiptId.of('00000003-0000-4000-8000-000000000001'), warehouseId: WarehouseRef.of(MAIN), date: PurchaseDate.of('2026-01-10') },
        defaultCurrency,
        {
          date: PurchaseDate.of('2026-01-09'),
          reason: null,
          notes: null,
          lines: [line()],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(ReturnBeforeReceiptError);
  });

  it('rejects a return without lines', () => {
    expect(() =>
      PurchaseReturn.draft(
        PurchaseReturnId.of('00000000-0000-4000-8000-000000000001'),
        TenantId.of(TENANT_A),
        'DVC-0001',
        { id: SupplierId.of(SUPPLIER) },
        { id: GoodsReceiptId.of('00000003-0000-4000-8000-000000000001'), warehouseId: WarehouseRef.of(MAIN), date: PurchaseDate.of('2026-01-10') },
        defaultCurrency,
        {
          date: PurchaseDate.of('2026-01-12'),
          reason: null,
          notes: null,
          lines: [],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(EmptyPurchaseReturnError);
  });

  it('rejects duplicate receipt lines in the same return', () => {
    const l1 = line('00000001-0000-4000-8000-000000000001', 2);
    const l2 = line('00000001-0000-4000-8000-000000000001', 3);

    expect(() =>
      PurchaseReturn.draft(
        PurchaseReturnId.of('00000000-0000-4000-8000-000000000001'),
        TenantId.of(TENANT_A),
        'DVC-0001',
        { id: SupplierId.of(SUPPLIER) },
        { id: GoodsReceiptId.of('00000003-0000-4000-8000-000000000001'), warehouseId: WarehouseRef.of(MAIN), date: PurchaseDate.of('2026-01-10') },
        defaultCurrency,
        {
          date: PurchaseDate.of('2026-01-12'),
          reason: null,
          notes: null,
          lines: [l1, l2],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(DuplicatePurchaseReturnLineError);
  });

  it('confirms a draft return and assigns restore movement ids', () => {
    const returnDoc = PurchaseReturn.draft(
      PurchaseReturnId.of('00000000-0000-4000-8000-000000000001'),
      TenantId.of(TENANT_A),
      'DVC-0001',
      { id: SupplierId.of(SUPPLIER) },
      { id: GoodsReceiptId.of('00000003-0000-4000-8000-000000000001'), warehouseId: WarehouseRef.of(MAIN), date: PurchaseDate.of('2026-01-10') },
      defaultCurrency,
      {
        date: PurchaseDate.of('2026-01-12'),
        reason: null,
        notes: null,
        lines: [line()],
      },
      NOW,
      TODAY,
    );

    const movementMap = new Map([['00000002-0000-4000-8000-000000000001', 'mov-99']]);
    returnDoc.confirm(NOW, movementMap);

    expect(returnDoc.currentStatus()).toBe('confirmed');
    expect(returnDoc.lines()[0].restoresMovementId).toBe('mov-99');
    expect(() => returnDoc.confirm(NOW, movementMap)).toThrow(PurchaseReturnNotConfirmableError);
  });

  it('cancels a return and forbids editing afterwards', () => {
    const returnDoc = PurchaseReturn.draft(
      PurchaseReturnId.of('00000000-0000-4000-8000-000000000001'),
      TenantId.of(TENANT_A),
      'DVC-0001',
      { id: SupplierId.of(SUPPLIER) },
      { id: GoodsReceiptId.of('00000003-0000-4000-8000-000000000001'), warehouseId: WarehouseRef.of(MAIN), date: PurchaseDate.of('2026-01-10') },
      defaultCurrency,
      {
        date: PurchaseDate.of('2026-01-12'),
        reason: null,
        notes: null,
        lines: [line()],
      },
      NOW,
      TODAY,
    );

    returnDoc.cancel(NOW);
    expect(returnDoc.currentStatus()).toBe('cancelled');
    expect(() => returnDoc.cancel(NOW)).toThrow(PurchaseReturnAlreadyCancelledError);
    expect(() =>
      returnDoc.rewrite(
        { date: PurchaseDate.of('2026-01-14'), reason: null, notes: null, lines: [line()] },
        PurchaseDate.of('2026-01-10'),
        NOW,
        TODAY,
      ),
    ).toThrow(PurchaseReturnNotEditableError);
  });
});
