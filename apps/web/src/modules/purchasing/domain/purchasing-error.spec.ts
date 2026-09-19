import { describe, expect, it } from 'vitest';
import { AccessError } from '../../access/domain/access-error';
import { readablePurchasingError } from './purchasing-error';

const FALLBACK = 'No se pudo guardar.';

describe('readablePurchasingError', () => {
  it('explains the receiving guard without the quantities of the API message', () => {
    const error = AccessError.fromStatus(409, {
      code: 'ReceiptExceedsPendingError',
      message: 'Order line <x> has 6 pending and 7 was received.',
    });

    expect(readablePurchasingError(error, FALLBACK)).toBe('La entrada trae más de lo que queda pendiente en la orden.');
  });

  it('tells how to cancel an order that already received goods', () => {
    expect(readablePurchasingError(AccessError.fromStatus(409, { code: 'PurchaseOrderWithReceiptsError' }), FALLBACK)).toContain(
      'anula primero sus entradas',
    );
  });

  it('points to the company parameters when a price has too many decimals', () => {
    expect(readablePurchasingError(AccessError.fromStatus(400, { code: 'PriceDecimalsExceededError' }), FALLBACK)).toContain(
      'más decimales',
    );
  });

  it('asks to review and save an order whose item changed', () => {
    expect(readablePurchasingError(AccessError.fromStatus(409, { code: 'PurchaseItemChangedError' }), FALLBACK)).toContain(
      'revisa las cantidades',
    );
  });

  it('explains that a service is not received into a warehouse', () => {
    expect(readablePurchasingError(AccessError.fromStatus(400, { code: 'ServiceNotReceivableError' }), FALLBACK)).toContain(
      'factura del proveedor',
    );
  });

  it('points at the lines instead of a JSON path', () => {
    expect(
      readablePurchasingError(AccessError.fromStatus(400, { code: 'ValidationError', fields: ['lines.0.unitCost'] }), FALLBACK),
    ).toContain('Revisa las líneas');
  });

  it('falls back to the inventory, catalog and access translations', () => {
    expect(readablePurchasingError(AccessError.fromStatus(409, { code: 'ItemWithStockError' }), FALLBACK)).toContain('existencia');
    expect(readablePurchasingError(new Error('boom'), FALLBACK)).toBe(FALLBACK);
  });
});
