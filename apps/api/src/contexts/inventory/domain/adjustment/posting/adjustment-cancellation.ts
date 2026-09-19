import { StockMovements } from '../../stock/posting/stock-movements.js';
import { Ledger } from '../../stock/posting/stock-ledger.js';
import { Adjustment } from '../adjustment.entity.js';
import { Posting } from './adjustment-posting.js';

// Anular: un borrador solo cambia de estado. Uno confirmado revierte cada movimiento que
// escribio con otro que lo cita.
export class AdjustmentCancellation {
  constructor(private readonly movements: StockMovements) {}

  apply(adjustment: Adjustment, ledger: Ledger, now: Date, userId: string | null = null): Posting {
    const wasConfirmed = adjustment.currentStatus() === 'confirmed';

    adjustment.cancel(now, userId);

    if (!wasConfirmed) {
      return { adjustment, stocks: [], movements: [] };
    }

    return { adjustment, ...this.movements.reverse(ledger, { type: 'adjustment', id: adjustment.id.value, date: adjustment.date().value }, now) };
  }
}
