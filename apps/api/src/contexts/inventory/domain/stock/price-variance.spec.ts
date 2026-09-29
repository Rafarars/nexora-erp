import { describe, expect, it } from 'vitest';
import { InventoryMovement, MovementId } from '../movement/inventory-movement.entity.js';
import { Quantity } from '../quantity/quantity.vo.js';
import { UnitCost } from '../quantity/unit-cost.vo.js';
import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { calculatePriceVariance } from './price-variance.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ITEM = 'f1111111-1111-4111-8111-111111111111';
const WAREHOUSE = '01111111-1111-4111-8111-111111111111';

function makeMovement(params: {
  id?: string;
  sequence: number;
  direction: 'in' | 'out';
  quantity: number;
  unitCost: number;
  balanceQuantity: number;
  balanceAverageCost: number;
  originType: 'receipt' | 'dispatch' | 'sales_return' | 'purchase_return' | 'adjustment';
  originId: string;
  restoresMovementId?: string | null;
}): InventoryMovement {
  const movId = params.id ?? `a0000000-0000-4000-8000-${String(params.sequence).padStart(12, '0')}`;
  return InventoryMovement.record({
    id: MovementId.of(movId),
    tenantId: TenantId.of(TENANT),
    itemId: ItemRef.of(ITEM),
    warehouseId: WarehouseRef.of(WAREHOUSE),
    sequence: params.sequence,
    direction: params.direction,
    quantity: Quantity.of(params.quantity),
    unitCost: UnitCost.of(params.unitCost),
    balanceQuantity: Quantity.of(params.balanceQuantity),
    balanceAverageCost: UnitCost.of(params.balanceAverageCost),
    origin: {
      type: params.originType,
      id: params.originId,
      lineId: 'line-1',
      date: '2026-10-01',
    },
    reversalOfId: null,
    restoresMovementId: params.restoresMovementId ? MovementId.of(params.restoresMovementId) : null,
    occurredAt: new Date('2026-10-01T10:00:00Z'),
  });
}

describe('calculatePriceVariance (H9 §3.3 & §5.3)', () => {
  const sourceMovId = 'e1111111-1111-4111-8111-111111111111';

  it('keeps 100% in stock if there were no subsequent exits', () => {
    const res = calculatePriceVariance(100, sourceMovId, []);
    expect(res.stockPart).toBe(100);
    expect(res.soldPart).toBe(0);
  });

  it('allocates 100% to sold/cogs if stock was completely exhausted', () => {
    // 10 entraron, 10 salieron
    const exit = makeMovement({
      sequence: 2,
      direction: 'out',
      quantity: 10,
      unitCost: 100,
      balanceQuantity: 0,
      balanceAverageCost: 100,
      originType: 'dispatch',
      originId: 'disp-1',
    });

    const res = calculatePriceVariance(100, sourceMovId, [exit]);
    expect(res.stockPart).toBe(0);
    expect(res.soldPart).toBe(100);
  });

  it('handles negative price variance (cheaper invoice than receipt)', () => {
    // 10 entraron a 100, factura a 80 (-20 por unidad => amount = -200)
    // Se venden 5: ratio = 5/10 = 0.5
    const exit = makeMovement({
      sequence: 2,
      direction: 'out',
      quantity: 5,
      unitCost: 100,
      balanceQuantity: 5,
      balanceAverageCost: 100,
      originType: 'dispatch',
      originId: 'disp-1',
    });

    const res = calculatePriceVariance(-200, sourceMovId, [exit]);
    expect(res.stockPart).toBe(-100);
    expect(res.soldPart).toBe(-100);
  });

  it('calculates correctly when units sold between invoice and approval (10 at 100, invoice 110, 6 sold => +40 stock, +60 sold)', () => {
    // H9 §7: "Se vende entre la factura y la aprobacion (10 a 100, factura 110, se venden 6): al aprobar, +40 a bodega y +60 a resultado"
    // Difference = (110 - 100) * 10 = +100
    // Exit: 6 sold, balance 4 (before 10)
    const exit = makeMovement({
      sequence: 2,
      direction: 'out',
      quantity: 6,
      unitCost: 100,
      balanceQuantity: 4,
      balanceAverageCost: 100,
      originType: 'dispatch',
      originId: 'disp-1',
    });

    const res = calculatePriceVariance(100, sourceMovId, [exit]);
    expect(res.stockPart).toBe(40);
    expect(res.soldPart).toBe(60);
  });

  it('incoming stock after sale does not reduce original ratio (10 at 100, 6 sold, 10 at 90 enter => +40 to stock for 14 units)', () => {
    // H9 §7: "Entra mercancia entre la factura y la aprobacion (10 a 100, se venden 6, entran 10 a 90): van +40 a bodega"
    const exit = makeMovement({
      sequence: 2,
      direction: 'out',
      quantity: 6,
      unitCost: 100,
      balanceQuantity: 4,
      balanceAverageCost: 100,
      originType: 'dispatch',
      originId: 'disp-1',
    });
    const entry = makeMovement({
      sequence: 3,
      direction: 'in',
      quantity: 10,
      unitCost: 90,
      balanceQuantity: 14,
      balanceAverageCost: 92.8571,
      originType: 'receipt',
      originId: 'rec-2',
    });

    const res = calculatePriceVariance(100, sourceMovId, [exit, entry]);
    expect(res.stockPart).toBe(40);
    expect(res.soldPart).toBe(60);
  });

  it('handles two entries before invoicing (10 at 100, 10 at 150, 15 sold, invoice first lot at 110 => +25 stock, +75 sold)', () => {
    // H9 §7: "Dos entradas a distinto precio antes de facturar (10 a 100, 10 a 150, se venden 15, factura del primer lote a 110): +25 a bodega y +75 a resultado"
    // Entry 1: 10
    // Entry 2: 10 (balance 20)
    // Sale of 15: balance 5 (before 20 => ratio 5/20 = 0.25)
    // Invoice first lot: difference = (110 - 100) * 10 = +100
    const entry2 = makeMovement({
      sequence: 2,
      direction: 'in',
      quantity: 10,
      unitCost: 150,
      balanceQuantity: 20,
      balanceAverageCost: 125,
      originType: 'receipt',
      originId: 'rec-2',
    });
    const exit = makeMovement({
      sequence: 3,
      direction: 'out',
      quantity: 15,
      unitCost: 125,
      balanceQuantity: 5,
      balanceAverageCost: 125,
      originType: 'dispatch',
      originId: 'disp-1',
    });

    const res = calculatePriceVariance(100, sourceMovId, [entry2, exit]);
    expect(res.stockPart).toBe(25);
    expect(res.soldPart).toBe(75);
  });

  it('purchase return of the same receipt does not count as exit in variance allocation', () => {
    // H9 §7: "Una devolucion a proveedor de esa misma entrada, entre la factura y la aprobacion, no cuenta como salida en el reparto"
    const returnSameReceipt = makeMovement({
      sequence: 2,
      direction: 'out',
      quantity: 3,
      unitCost: 100,
      balanceQuantity: 7,
      balanceAverageCost: 100,
      originType: 'purchase_return',
      originId: 'dvc-1',
      restoresMovementId: sourceMovId, // Cita la misma entrada
    });

    const res = calculatePriceVariance(100, sourceMovId, [returnSameReceipt]);
    expect(res.stockPart).toBe(100);
    expect(res.soldPart).toBe(0);
  });

  it('Ajuste 4 resuelto: purchase return of ANOTHER receipt does not count as exit in variance allocation', () => {
    // Escenario de ajuste 4:
    // - Entrada 1 (origen a revaluar): 10 unidades a 100. Monto a revaluar: +100 (factura a 110).
    // - Entrada 2 (otra entrada): 10 unidades a 150.
    // - Devolución a proveedor de 5 unidades de la Entrada 2 (sale a su costo congelado de entrada, no al promedio).
    // Al no ser una salida ordinaria que se lleve parte del costo promedio, no reduce el saldo de la entrada 1.
    // Toda la mercancía de la entrada 1 sigue en bodega: 100 a bodega, 0 a resultado.
    const otherEntryId = 'e2222222-2222-4222-8222-222222222222';
    const entry2 = makeMovement({
      id: otherEntryId,
      sequence: 2,
      direction: 'in',
      quantity: 10,
      unitCost: 150,
      balanceQuantity: 20,
      balanceAverageCost: 125,
      originType: 'receipt',
      originId: 'rec-2',
    });
    const returnOtherReceipt = makeMovement({
      sequence: 3,
      direction: 'out',
      quantity: 5,
      unitCost: 150,
      balanceQuantity: 15,
      balanceAverageCost: 116.6667,
      originType: 'purchase_return',
      originId: 'dvc-2',
      restoresMovementId: otherEntryId, // Cita OTRA entrada
    });

    const res = calculatePriceVariance(100, sourceMovId, [entry2, returnOtherReceipt]);
    expect(res.stockPart).toBe(100);
    expect(res.soldPart).toBe(0);
  });

  it('revaluation between receipt and invoice approval does not send variance to cogs (10 at 100, invoice 110, reval manual => +100 stock)', () => {
    // Una revaluación entre la entrada y la aprobación escribe una salida de toda la existencia
    // y una entrada al costo nuevo. Su salida deja temporalmente la existencia en 0, pero la mercancía
    // sigue íntegra en bodega.
    const revalAdjId = 'adj-reval-1';
    const revalOut = makeMovement({
      sequence: 2,
      direction: 'out',
      quantity: 10,
      unitCost: 100,
      balanceQuantity: 0,
      balanceAverageCost: 100,
      originType: 'adjustment',
      originId: revalAdjId,
    });
    const revalIn = makeMovement({
      sequence: 3,
      direction: 'in',
      quantity: 10,
      unitCost: 120,
      balanceQuantity: 10,
      balanceAverageCost: 120,
      originType: 'adjustment',
      originId: revalAdjId,
    });

    const res = calculatePriceVariance(100, sourceMovId, [revalOut, revalIn]);
    expect(res.stockPart).toBe(100);
    expect(res.soldPart).toBe(0);
  });

  it('reversed exit (e.g. cancelled dispatch) does not reduce variance allocation', () => {
    // Un despacho que se anula después no se llevó nada: su reverso lo deshace.
    const dispatchId = 'a0000000-0000-4000-8000-000000000002';
    const dispatch = makeMovement({
      id: dispatchId,
      sequence: 2,
      direction: 'out',
      quantity: 4,
      unitCost: 100,
      balanceQuantity: 6,
      balanceAverageCost: 100,
      originType: 'dispatch',
      originId: 'disp-1',
    });

    const reversal = InventoryMovement.record({
      id: MovementId.of('a0000000-0000-4000-8000-000000000003'),
      tenantId: TenantId.of(TENANT),
      itemId: ItemRef.of(ITEM),
      warehouseId: WarehouseRef.of(WAREHOUSE),
      sequence: 3,
      direction: 'in',
      quantity: Quantity.of(4),
      unitCost: UnitCost.of(100),
      balanceQuantity: Quantity.of(10),
      balanceAverageCost: UnitCost.of(100),
      origin: {
        type: 'dispatch',
        id: 'disp-1',
        lineId: 'line-1',
        date: '2026-10-02',
      },
      reversalOfId: MovementId.of(dispatchId),
      restoresMovementId: null,
      occurredAt: new Date('2026-10-02T10:00:00Z'),
    });

    const res = calculatePriceVariance(100, sourceMovId, [dispatch, reversal]);
    expect(res.stockPart).toBe(100);
    expect(res.soldPart).toBe(0);
  });
});
