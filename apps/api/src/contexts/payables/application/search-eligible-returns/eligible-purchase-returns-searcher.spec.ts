import { describe, expect, it } from 'vitest';
import { PayableInvoiceNotFoundError } from '../../domain/errors/payables.errors.js';
import { InMemoryPayablesStore } from '../../infrastructure/testing/in-memory-payables-store.js';
import { EligiblePurchaseReturnsSearcher } from './eligible-purchase-returns-searcher.js';

describe('EligiblePurchaseReturnsSearcher', () => {
  const TENANT = '11111111-1111-4111-8111-111111111111';
  const SUPPLIER_ID = 'e8000000-0000-4000-8000-000000000001';
  const INVOICE_ID = 'f1000000-0000-4000-8000-000000000001';
  const RECEIPT_LINE_1 = 'rl-100000-0000-4000-8000-000000000001';
  const RECEIPT_LINE_2 = 'rl-200000-0000-4000-8000-000000000002';
  const RECEIPT_LINE_OTHER = 'rl-999999-0000-4000-8000-000000000099';

  function setupStore() {
    const store = new InMemoryPayablesStore();
    store.supplier(TENANT, {
      id: SUPPLIER_ID,
      code: 'PRV000001',
      name: 'Proveedor Test',
      paymentTermDays: 15,
      isActive: true,
    });
    store.invoice(TENANT, {
      id: INVOICE_ID,
      code: 'FCP000001',
      supplierId: SUPPLIER_ID,
      issueDate: '2026-09-01',
      dueDate: '2026-09-15',
      currency: 'USD',
      exchangeRate: 36.5,
      baseCurrency: 'VES',
      baseExchangeRate: 1,
      manualExchangeRate: false,
      total: 116,
      status: 'confirmed',
    });
    store.setInvoiceLines(INVOICE_ID, [
      {
        id: 'inv-line-1',
        itemId: 'item-1',
        itemSku: 'SKU-01',
        itemName: 'Producto 1',
        unitId: 'unit-1',
        subtotal: 60,
        receiptLineId: RECEIPT_LINE_1,
      },
      {
        id: 'inv-line-2',
        itemId: 'item-2',
        itemSku: 'SKU-02',
        itemName: 'Producto 2',
        unitId: 'unit-1',
        subtotal: 40,
        receiptLineId: RECEIPT_LINE_2,
      },
    ]);
    return store;
  }

  it('throws PayableInvoiceNotFoundError if the invoice does not exist', async () => {
    const store = new InMemoryPayablesStore();
    const searcher = new EligiblePurchaseReturnsSearcher(store.creditNotes, store.ledger);

    await expect(
      searcher.run({ tenantId: TENANT, invoiceId: 'non-existent' }),
    ).rejects.toThrow(PayableInvoiceNotFoundError);
  });

  it('returns empty array if the invoice has no receipt line references', async () => {
    const store = setupStore();
    store.setInvoiceLines(INVOICE_ID, [
      {
        id: 'inv-line-service',
        itemId: null,
        subtotal: 100,
        receiptLineId: null,
      },
    ]);
    const searcher = new EligiblePurchaseReturnsSearcher(store.creditNotes, store.ledger);

    const result = await searcher.run({ tenantId: TENANT, invoiceId: INVOICE_ID });
    expect(result).toEqual([]);
  });

  it('returns confirmed returns whose lines correspond to invoice receipt lines', async () => {
    const store = setupStore();
    store.purchaseReturn(
      TENANT,
      'ret-1',
      SUPPLIER_ID,
      'confirmed',
      'DVC000001',
      [RECEIPT_LINE_1],
      [
        {
          id: 'ret-line-1',
          receiptLineId: RECEIPT_LINE_1,
          itemId: 'item-1',
          itemSku: 'SKU-01',
          itemName: 'Producto 1',
          unitId: 'unit-1',
          quantity: 2,
          unitCost: 10,
        },
      ],
      '2026-09-04',
    );

    const searcher = new EligiblePurchaseReturnsSearcher(store.creditNotes, store.ledger);
    const result = await searcher.run({ tenantId: TENANT, invoiceId: INVOICE_ID });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'ret-1',
      code: 'DVC000001',
      date: '2026-09-04',
      lines: [
        {
          id: 'ret-line-1',
          receiptLineId: RECEIPT_LINE_1,
          itemId: 'item-1',
          itemSku: 'SKU-01',
          itemName: 'Producto 1',
          unitId: 'unit-1',
          concept: 'Devolución DVC000001 - Producto 1',
          quantity: 2,
          unitCost: 10,
          invoiceLineId: 'inv-line-1',
          invoicedUnitPrice: 60,
        },
      ],
    });
  });

  it('excludes returns that have lines from other receipts not invoiced by this invoice', async () => {
    const store = setupStore();
    store.purchaseReturn(
      TENANT,
      'ret-mismatch',
      SUPPLIER_ID,
      'confirmed',
      'DVC000002',
      [RECEIPT_LINE_1, RECEIPT_LINE_OTHER],
      [
        {
          id: 'ret-line-1',
          receiptLineId: RECEIPT_LINE_1,
          itemId: 'item-1',
          itemSku: 'SKU-01',
          itemName: 'Producto 1',
          unitId: 'unit-1',
          quantity: 1,
          unitCost: 10,
        },
        {
          id: 'ret-line-2',
          receiptLineId: RECEIPT_LINE_OTHER,
          itemId: 'item-99',
          itemSku: 'SKU-99',
          itemName: 'Producto 99',
          unitId: 'unit-1',
          quantity: 1,
          unitCost: 15,
        },
      ],
    );

    const searcher = new EligiblePurchaseReturnsSearcher(store.creditNotes, store.ledger);
    const result = await searcher.run({ tenantId: TENANT, invoiceId: INVOICE_ID });

    expect(result).toEqual([]);
  });

  it('excludes returns already credited by a confirmed credit note', async () => {
    const store = setupStore();
    store.purchaseReturn(
      TENANT,
      'ret-credited',
      SUPPLIER_ID,
      'confirmed',
      'DVC000003',
      [RECEIPT_LINE_1],
    );

    // Guardar una nota de crédito confirmada que acredita esa devolución
    store['creditNoteRows'].set('note-1', {
      id: 'note-1',
      tenantId: TENANT,
      code: 'NCP000001',
      supplierId: SUPPLIER_ID,
      invoiceId: INVOICE_ID,
      purchaseReturnId: 'ret-credited',
      issuePaymentId: null,
      issueDate: '2026-09-05',
      currency: 'USD',
      exchangeRate: 36.5,
      baseCurrency: 'VES',
      baseExchangeRate: 1,
      manualExchangeRate: false,
      reason: 'return',
      reasonDetail: null,
      notes: null,
      subtotal: 20,
      tax: 0,
      total: 20,
      subtotalVes: 730,
      taxVes: 0,
      totalVes: 730,
      priceDifference: 0,
      exchangeDifference: 0,
      confirmedAt: new Date('2026-09-05T00:00:00.000Z'),
      cancelledAt: null,
      status: 'confirmed',
      lines: [],
      createdAt: new Date('2026-09-05T00:00:00.000Z'),
      updatedAt: new Date('2026-09-05T00:00:00.000Z'),
    });

    const searcher = new EligiblePurchaseReturnsSearcher(store.creditNotes, store.ledger);
    const result = await searcher.run({ tenantId: TENANT, invoiceId: INVOICE_ID });

    expect(result).toEqual([]);
  });
});
