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

  it('Ajuste 4 del usuario: return of ANOTHER receipt and variance allocation', () => {
    // Ajuste 4 del usuario:
    // "PriceVariance y las devoluciones de OTRAS entradas. Tu plan excluye bien las devoluciones de la misma entrada.
    // Una devolucion a proveedor de otra entrada del mismo articulo tambien sale al costo congelado de su entrada,
    // no al promedio, asi que multiplicar por existencia despues / antes no es exacto en ese caso.
    // No lo cambies: escribe una prueba con ese caso, anota en el avance la cifra que da y la exacta,
    // y ponlo entre las tres dudas si la diferencia existe."
    //
    // Escenario:
    // - Entrada 1 (origen a revaluar): 10 unidades a 100 (Total = 1000). Monto a revaluar: +100 (factura a 110).
    // - Entrada 2 (otra entrada): 10 unidades a 150 (Total = 1500). Existencia = 20, promedio = 125.
    // - Devolución a proveedor de 5 unidades de la Entrada 2:
    //   En el kardex sale al costo congelado de Entrada 2 (150).
    //   Existencia antes de la devolución: 20.
    //   Existencia después de la devolución: 15.
    //   Fórmula PriceVariance: ratio = 15 / 20 = 0.75 => stockPart = 75, soldPart = 25.
    //   Cifra exacta teórica: Como la devolución fue de la Entrada 2 (ninguna unidad de Entrada 1 se devolvió ni se vendió),
    //   las 10 unidades de Entrada 1 siguen 100% en bodega, por lo que la cifra teórica exacta en bodega sería 100 (y 0 a resultado).
    //   La diferencia calculada es 75 vs 100 (diferencia de 25).
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
    // Cifra que da la formula actual:
    expect(res.stockPart).toBe(75);
    expect(res.soldPart).toBe(25);
    // Nota documentada para el avance y las 3 dudas:
    // Cifra que da: stockPart = 75, soldPart = 25
    // Cifra exacta teorica: stockPart = 100, soldPart = 0
  });
});
