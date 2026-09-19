import { describe, expect, it } from 'vitest';
import {
  AdjustmentAlreadyCancelledError,
  AdjustmentNotConfirmableError,
  AdjustmentNotEditableError,
  EmptyAdjustmentError,
  FutureAdjustmentDateError,
  InvalidAdjustmentDateError,
  InventoryTextTooLongError,
} from '../errors/inventory.errors.js';
import { Quantity } from '../quantity/quantity.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { MAIN, NOW, PIECE, TENANT_A, TODAY, WATER } from '../testing/inventory.mother.js';
import { AdjustmentDate } from './adjustment-date.vo.js';
import { AdjustmentLine, AdjustmentLineId } from './adjustment-line.js';
import { Adjustment, AdjustmentDetails, AdjustmentId } from './adjustment.entity.js';

const ID = 'ad111111-1111-4111-8111-111111111111';

function aLine(): AdjustmentLine {
  return AdjustmentLine.of({
    id: AdjustmentLineId.of('11111111-aaaa-4aaa-8aaa-111111111111'),
    lineNumber: 1,
    itemId: ItemRef.of(WATER),
    itemSku: 'PRUEBA-SKU',
    itemName: 'Articulo de prueba',
    unitId: UnitRef.of(PIECE),
    direction: 'in',
    quantity: Quantity.of(5),
    baseQuantity: Quantity.of(5),
    unitCost: null,
  });
}

function details(overrides: Partial<AdjustmentDetails> = {}): AdjustmentDetails {
  return { warehouseId: WarehouseRef.of(MAIN), date: AdjustmentDate.of(TODAY),
    type: 'correction', notes: null, lines: [aLine()], ...overrides };
}

const aDraft = () => Adjustment.draft(AdjustmentId.of(ID), TenantId.of(TENANT_A), 'AJU000001', details(), NOW, TODAY);

describe('AdjustmentDate', () => {
  it.each(['2026-02-30', '2026-13-01', '15/01/2026', '2026-1-5', ''])('rejects %j', (value) => {
    expect(() => AdjustmentDate.of(value)).toThrow(InvalidAdjustmentDateError);
  });

  it('accepts a leap day', () => {
    expect(AdjustmentDate.of('2024-02-29').value).toBe('2024-02-29');
  });

  // Un ajuste corrige lo que ya paso.
  it('refuses a date after today', () => {
    expect(() => AdjustmentDate.of('2026-01-16').ensureNotAfter(TODAY)).toThrow(FutureAdjustmentDateError);
    expect(() => AdjustmentDate.of(TODAY).ensureNotAfter(TODAY)).not.toThrow();
  });
});

describe('Adjustment', () => {
  it('is born as a draft', () => {
    expect(aDraft().currentStatus()).toBe('draft');
  });

  it('needs at least one line', () => {
    expect(() => Adjustment.draft(AdjustmentId.of(ID), TenantId.of(TENANT_A), 'AJU000001', details({ lines: [] }), NOW, TODAY)).toThrow(
      EmptyAdjustmentError,
    );
  });

  it('trims its notes and refuses them past 500 characters', () => {
    const adjustment = aDraft();

    adjustment.update(details({ notes: '  conteo de enero  ' }), NOW, TODAY);
    expect(adjustment.toPrimitives().notes).toBe('conteo de enero');

    expect(() => adjustment.update(details({ notes: 'x'.repeat(501) }), NOW, TODAY)).toThrow(InventoryTextTooLongError);
  });

  it('goes from draft to confirmed to cancelled', () => {
    const adjustment = aDraft();

    adjustment.confirm(NOW);
    expect(adjustment.currentStatus()).toBe('confirmed');

    adjustment.cancel(NOW);
    expect(adjustment.toPrimitives()).toMatchObject({ status: 'cancelled', confirmedAt: NOW, cancelledAt: NOW });
  });

  // Lo confirmado ya movio existencia: cambiarlo reescribiria la historia.
  it('cannot be edited once confirmed', () => {
    const adjustment = aDraft();
    adjustment.confirm(NOW);

    expect(() => adjustment.update(details(), NOW, TODAY)).toThrow(AdjustmentNotEditableError);
  });

  it('cannot be confirmed twice', () => {
    const adjustment = aDraft();
    adjustment.confirm(NOW);

    expect(() => adjustment.confirm(NOW)).toThrow(AdjustmentNotConfirmableError);
  });

  it('cannot be confirmed or cancelled once cancelled', () => {
    const adjustment = aDraft();
    adjustment.cancel(NOW);

    expect(() => adjustment.confirm(NOW)).toThrow(AdjustmentNotConfirmableError);
    expect(() => adjustment.cancel(NOW)).toThrow(AdjustmentAlreadyCancelledError);
  });

  it('survives a round trip to primitives', () => {
    const adjustment = aDraft();

    expect(Adjustment.fromPrimitives(adjustment.toPrimitives()).toPrimitives()).toEqual(adjustment.toPrimitives());
  });
});
