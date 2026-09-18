import { describe, expect, it } from 'vitest';
import type { Session } from '../../access/domain/session';
import { AccessError } from '../../access/domain/access-error';
import { dispatchActions, dispatchableLines, orderActions, paymentTermLabel, summarizeOrderLines } from './sales';
import type { Dispatch, OrderLine, SalesOrder } from './sales';
import { readableSalesError } from './sales-error';
import { visibleSalesSections } from './sales-sections';

const line = (overrides: Partial<OrderLine>): OrderLine => ({
  id: 'l1', lineNumber: 1, itemId: 'water', sku: 'AGUA-500', itemName: 'Agua', unitId: 'box', unitAbbreviation: 'cja',
  quantity: 10, baseQuantity: 240, unitPrice: 30, listPrice: 30, movesStock: true, invoicedQuantity: 0, taxRate: 16, dispatchedQuantity: 0, pendingQuantity: 10, subtotal: 300, ...overrides,
});

describe('orderActions', () => {
  const goods = [line({})];
  const service = [line({ movesStock: false })];

  it('offers editing, confirming and cancelling a draft, but not dispatching', () => {
    expect(orderActions({ status: 'draft', lines: goods })).toEqual({ edit: true, confirm: true, cancel: true, dispatch: false, invoice: false });
  });

  // Despachado en parte quiere decir que algo salio ya: por eso no se puede anular.
  it('offers only dispatching the rest of a partially dispatched order', () => {
    const half = [line({ dispatchedQuantity: 4 })];

    expect(orderActions({ status: 'partially_dispatched', lines: half })).toEqual({ edit: false, confirm: false, cancel: false, dispatch: true, invoice: false });
  });

  // Nace despachado sin tener un despacho: anularlo tiene que seguir ofreciendose.
  it('offers cancelling an order of only services while nothing was invoiced', () => {
    expect(orderActions({ status: 'dispatched', lines: service })).toMatchObject({ cancel: true, invoice: true });
    expect(orderActions({ status: 'dispatched', lines: [line({ movesStock: false, invoicedQuantity: 10 })] })).toMatchObject({ cancel: false, invoice: false });
  });

  // Un pedido que solo vende servicios no se despacha: se factura directo.
  it('offers invoicing, not dispatching, an order with only services', () => {
    expect(orderActions({ status: 'confirmed', lines: service })).toMatchObject({ dispatch: false, invoice: true });
  });

  it('stops offering to invoice what was already invoiced', () => {
    expect(orderActions({ status: 'confirmed', lines: [line({ movesStock: false, invoicedQuantity: 10 })] })).toMatchObject({ invoice: false });
  });
});

describe('dispatchActions', () => {
  it('offers invoicing and cancelling a confirmed dispatch without invoice', () => {
    expect(dispatchActions({ status: 'confirmed', invoice: null })).toEqual({ edit: false, confirm: false, cancel: true, invoice: true });
  });

  // Anular un despacho facturado exige anular antes su factura.
  it('offers nothing on an invoiced dispatch', () => {
    expect(dispatchActions({ status: 'confirmed', invoice: { id: 'i', code: 'FAC000001' } })).toEqual({ edit: false, confirm: false, cancel: false, invoice: false });
  });
});

describe('order helpers', () => {
  it('summarizes what was dispatched only when something was', () => {
    expect(summarizeOrderLines([line({ dispatchedQuantity: 4 }), line({ sku: 'JABON', unitAbbreviation: 'kg', quantity: 2.5 })])).toBe(
      '10 cja AGUA-500 (4 despachadas) · 2,5 kg JABON',
    );
  });

  it('offers the lines with something pending, and those a draft already carries', () => {
    const order = { lines: [line({ id: 'done', pendingQuantity: 0 }), line({ id: 'open' })] } as SalesOrder;
    const draft = { lines: [{ orderLineId: 'done', quantity: 2 }] } as unknown as Dispatch;

    expect(dispatchableLines(order, null).map((r) => r.line.id)).toEqual(['open']);
    expect(dispatchableLines(order, draft).map((r) => [r.line.id, r.quantity])).toEqual([['done', 2], ['open', 0]]);
  });

  it('reads a payment term the way a person does', () => {
    expect([paymentTermLabel(0), paymentTermLabel(30)]).toEqual(['Contado', '30 días']);
  });
});

describe('readableSalesError', () => {
  it('explains the reservation guard without the quantities of the API message', () => {
    const error = AccessError.fromStatus(409, { code: 'InsufficientAvailabilityError', message: 'has 3 available and 5 was ordered' });

    expect(readableSalesError(error, 'x')).toBe('No hay existencia disponible suficiente para reservar este pedido.');
  });

  it('asks to review and save an order whose item changed', () => {
    expect(readableSalesError(AccessError.fromStatus(409, { code: 'SalesItemChangedError' }), 'x')).toContain('revisa las cantidades');
  });

  it('falls back to purchasing, inventory, catalog and access translations', () => {
    expect(readableSalesError(AccessError.fromStatus(409, { code: 'InsufficientStockError' }), 'x')).toContain('existencia');
  });
});

describe('visibleSalesSections', () => {
  const session = (overrides: Partial<Session>): Session => ({
    userId: 'u', name: 'Ana', email: 'ana@acme.com', tenantId: 't', tenantName: 'Acme', permissions: [], grantsAll: false, availableTenants: [], ...overrides,
  });

  it('shows every section to an administrator and only what a role can read otherwise', () => {
    expect(visibleSalesSections(session({ grantsAll: true }))).toHaveLength(5);
    expect(visibleSalesSections(session({ permissions: ['sales.invoices.search'] })).map((s) => s.label)).toEqual(['Facturas']);
  });
});
