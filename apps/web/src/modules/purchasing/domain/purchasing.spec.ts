import { describe, expect, it } from 'vitest';
import { formatAmount, orderActions, receiptActions, receivableLines, summarizeOrderLines } from './purchasing';
import type { GoodsReceipt, OrderLine, PurchaseOrder } from './purchasing';

const line = (overrides: Partial<OrderLine>): OrderLine => ({
  id: 'l1',
  lineNumber: 1,
  itemId: 'water',
  sku: 'AGUA-500',
  itemName: 'Agua',
  unitId: 'box',
  unitAbbreviation: 'cja',
  quantity: 10,
  baseQuantity: 240,
  unitCost: 12,
  taxRate: 16,
  receivedQuantity: 0,
  pendingQuantity: 10,
  subtotal: 120,
  ...overrides,
});

const order = (lines: OrderLine[]): PurchaseOrder => ({
  id: 'o1',
  code: 'OC000001',
  supplier: { id: 's', name: 'Andina' },
  warehouse: { id: 'w', name: 'Principal' },
  date: '2026-09-01',
  expectedDate: null,
  notes: null,
  status: 'partially_received',
  totals: { subtotal: 120, tax: 19.2, total: 139.2 },
  lines,
});

describe('orderActions', () => {
  it('offers editing, confirming and cancelling a draft, but not receiving', () => {
    expect(orderActions({ status: 'draft' })).toEqual({ edit: true, confirm: true, cancel: true, receive: false });
  });

  it('offers receiving and cancelling a confirmed order', () => {
    expect(orderActions({ status: 'confirmed' })).toEqual({ edit: false, confirm: false, cancel: true, receive: true });
  });

  // Anular una orden con mercancia recibida no se ofrece: primero se anulan sus entradas.
  it('offers only receiving the rest of a partially received order', () => {
    expect(orderActions({ status: 'partially_received' })).toEqual({ edit: false, confirm: false, cancel: false, receive: true });
  });

  it.each(['received', 'cancelled'] as const)('offers nothing on a %s order', (status) => {
    expect(orderActions({ status })).toEqual({ edit: false, confirm: false, cancel: false, receive: false });
  });
});

describe('receiptActions', () => {
  it('offers everything on a draft and only cancelling once confirmed', () => {
    expect(receiptActions({ status: 'draft' })).toEqual({ edit: true, confirm: true, cancel: true });
    expect(receiptActions({ status: 'confirmed' })).toEqual({ edit: false, confirm: false, cancel: true });
    expect(receiptActions({ status: 'cancelled' })).toEqual({ edit: false, confirm: false, cancel: false });
  });
});

describe('summarizeOrderLines', () => {
  it('says what was received only when something was', () => {
    const text = summarizeOrderLines([line({ receivedQuantity: 4 }), line({ sku: 'JABON', unitAbbreviation: 'kg', quantity: 2.5 })]);

    expect(text).toBe('10 cja AGUA-500 (4 recibidas) · 2,5 kg JABON');
  });
});

describe('receivableLines', () => {
  it('offers the lines with something pending, and those the draft already carries', () => {
    const done = line({ id: 'done', pendingQuantity: 0, receivedQuantity: 10 });
    const open = line({ id: 'open', pendingQuantity: 6, receivedQuantity: 4 });
    const receipt = { lines: [{ orderLineId: 'done', quantity: 3 }] } as unknown as GoodsReceipt;

    expect(receivableLines(order([done, open]), null).map((r) => r.line.id)).toEqual(['open']);
    expect(receivableLines(order([done, open]), receipt)).toMatchObject([{ line: { id: 'done' }, quantity: 3 }, { line: { id: 'open' }, quantity: 0 }]);
  });
});

describe('formatAmount', () => {
  it('always shows cents', () => {
    expect(formatAmount(149.2)).toBe('149,20');
  });
});
