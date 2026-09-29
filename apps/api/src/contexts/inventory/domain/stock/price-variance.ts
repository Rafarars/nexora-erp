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

  let ratio = 1.0;

  for (const mov of subsequentMovements) {
    if (mov.direction !== 'out') continue;

    // Una devolucion a proveedor de esa misma entrada no cuenta como salida en el reparto (H9 §3.3)
    if (mov.origin.type === 'purchase_return' && mov.restoresMovementId?.value === sourceMovementId) {
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
