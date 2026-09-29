import { InventoryMovement } from '../movement/inventory-movement.entity.js';

export interface PriceVarianceResult {
  stockPart: number;
  soldPart: number;
}

function round4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

// Reparte la diferencia de precio entre lo que sigue en bodega (stockPart)
// y lo que ya salio (soldPart) desde el movimiento de entrada original (H9 §3.3 y §5.3).
// La parte en bodega es el importe por el producto, en cada salida posterior desde
// ese movimiento, de (existencia despues / existencia antes); el resto va a resultado.
export function calculatePriceVariance(
  amount: number,
  sourceMovementId: string,
  subsequentMovements: InventoryMovement[],
): PriceVarianceResult {
  if (amount === 0) {
    return { stockPart: 0, soldPart: 0 };
  }

  // 1. Detectar salidas anuladas por reversión (ni la salida revertida ni su reverso se llevaron nada)
  const reversedMovementIds = new Set<string>();
  for (const mov of subsequentMovements) {
    if (mov.reversalOfId) {
      reversedMovementIds.add(mov.reversalOfId.value);
    }
  }

  // 2. Detectar movimientos de una revaluación (escriben salida de toda la existencia y entrada al nuevo costo)
  const adjustmentOuts = new Set<string>();
  const adjustmentIns = new Set<string>();
  for (const mov of subsequentMovements) {
    if (mov.origin.type === 'adjustment') {
      if (mov.direction === 'out') adjustmentOuts.add(mov.origin.id);
      if (mov.direction === 'in') adjustmentIns.add(mov.origin.id);
    }
  }
  const revaluationAdjustmentIds = new Set<string>();
  for (const id of adjustmentOuts) {
    if (adjustmentIns.has(id)) {
      revaluationAdjustmentIds.add(id);
    }
  }

  let ratio = 1.0;

  for (const mov of subsequentMovements) {
    // Sólo cuentan las salidas ordinarias que no se anularon
    if (mov.direction !== 'out') continue;

    // No cuentan los reversos ni los movimientos que fueron revertidos
    if (mov.reversalOfId !== null || reversedMovementIds.has(mov.id.value)) {
      continue;
    }

    // No cuenta ninguna devolución a proveedor (salen a su costo congelado de entrada, no al promedio)
    if (mov.origin.type === 'purchase_return') {
      continue;
    }

    // No cuentan los movimientos de una revaluación
    if (mov.origin.type === 'adjustment' && revaluationAdjustmentIds.has(mov.origin.id)) {
      continue;
    }

    const qtyAfter = mov.balanceQuantity.toNumber();
    const qtyBefore = qtyAfter + mov.quantity.toNumber();

    if (qtyBefore > 0) {
      ratio *= qtyAfter / qtyBefore;
    } else {
      ratio = 0;
    }
  }

  const stockPart = round4(amount * ratio);
  const soldPart = round4(amount - stockPart);

  return { stockPart, soldPart };
}
