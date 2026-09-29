import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryPayablesStore } from '../infrastructure/testing/in-memory-payables-store.js';
import { PayableInvoiceSearcher } from './search-invoices/payable-invoice-searcher.js';
import { SupplierBalanceSearcher } from './search-supplier-balances/supplier-balance-searcher.js';
import { SupplierStatementSearcher } from './search-supplier-statement/supplier-statement-searcher.js';
import { SupplierPayment } from '../domain/payment/supplier-payment.entity.js';
import { PayableSupplierNotFoundError } from '../domain/errors/payables.errors.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
const SUPPLIER_A = 'e8000000-0000-4000-8000-000000000001';
const SUPPLIER_B = 'e8000000-0000-4000-8000-000000000002';
const INVOICE_1 = 'e4000000-0000-4000-8000-000000000001';
const INVOICE_2 = 'e4000000-0000-4000-8000-000000000002';
const INVOICE_3 = 'e4000000-0000-4000-8000-000000000003';

const calendar = {
  today: async () => '2026-09-20',
};

const rates = {
  companyCurrency: async () => 'USD',
  amountDecimals: async () => 2,
  priceDecimals: async () => 6,
  rateAt: async () => 1,
  rateFor: async () => 1,
  forDocument: async () => ({
    currency: 'USD',
    exchangeRate: 1,
    baseCurrency: 'USD',
    baseExchangeRate: 1,
    manualRate: false,
  }),
  convert: async (amount: number) => amount,
  convertFromBase: async (amount: number) => amount,
};


describe('payables balances and statements', () => {
  let store: InMemoryPayablesStore;
  let invoiceSearcher: PayableInvoiceSearcher;
  let balanceSearcher: SupplierBalanceSearcher;
  let statementSearcher: SupplierStatementSearcher;

  beforeEach(() => {
    store = new InMemoryPayablesStore();
    invoiceSearcher = new PayableInvoiceSearcher(store.ledger, calendar, rates);
    balanceSearcher = new SupplierBalanceSearcher(store.ledger, calendar, rates);
    statementSearcher = new SupplierStatementSearcher(store.ledger, store.payments, calendar, rates);

    store.supplier(TENANT, { id: SUPPLIER_A, code: 'PRV001', name: 'Proveedor Alpha', paymentTermDays: 30, isActive: true });
    store.supplier(TENANT, { id: SUPPLIER_B, code: 'PRV002', name: 'Proveedor Beta', paymentTermDays: 15, isActive: true });

    // Factura 1: Alpha, total 100, vence 2026-09-10 (vencida por 10 dias en days1To30)
    store.invoice(TENANT, {
      id: INVOICE_1,
      code: 'FCP000001',
      supplierId: SUPPLIER_A,
      issueDate: '2026-08-10',
      dueDate: '2026-09-10',
      status: 'confirmed',
      total: 100,
      currency: 'USD',
      exchangeRate: null,
      baseCurrency: 'USD',
      baseExchangeRate: null,
      manualExchangeRate: false,
    });

    // Factura 2: Alpha, total 200, vence 2026-09-25 (por vencer en current)
    store.invoice(TENANT, {
      id: INVOICE_2,
      code: 'FCP000002',
      supplierId: SUPPLIER_A,
      issueDate: '2026-08-25',
      dueDate: '2026-09-25',
      status: 'confirmed',
      total: 200,
      currency: 'USD',
      exchangeRate: null,
      baseCurrency: 'USD',
      baseExchangeRate: null,
      manualExchangeRate: false,
    });

    // Factura 3: Beta, total 300, vence 2026-09-01 (vencida por 19 dias en days1To30)
    store.invoice(TENANT, {
      id: INVOICE_3,
      code: 'FCP000003',
      supplierId: SUPPLIER_B,
      issueDate: '2026-08-15',
      dueDate: '2026-09-01',
      status: 'confirmed',
      total: 300,
      currency: 'USD',
      exchangeRate: null,
      baseCurrency: 'USD',
      baseExchangeRate: null,
      manualExchangeRate: false,
    });
  });

  describe('PayableInvoiceSearcher', () => {
    it('returns all payable invoices ordered by due date', async () => {
      const result = await invoiceSearcher.run({ tenantId: TENANT });

      expect(result.total).toBe(3);
      expect(result.invoices.map((i) => i.code)).toEqual(['FCP000003', 'FCP000001', 'FCP000002']);
      expect(result.invoices[0].daysOverdue).toBe(19);
      expect(result.invoices[0].bucket).toBe('days1To30');
      expect(result.invoices[2].daysOverdue).toBe(0);
      expect(result.invoices[2].bucket).toBe('current');
    });

    it('filters by supplierId', async () => {
      const result = await invoiceSearcher.run({ tenantId: TENANT, supplierId: SUPPLIER_A });

      expect(result.total).toBe(2);
      expect(result.invoices.map((i) => i.code)).toEqual(['FCP000001', 'FCP000002']);
    });

    it('rejects filtering by a supplier of another tenant', async () => {
      await expect(invoiceSearcher.run({ tenantId: OTHER_TENANT, supplierId: SUPPLIER_A })).rejects.toThrow(
        PayableSupplierNotFoundError,
      );
    });

    it('filters only overdue invoices', async () => {
      const result = await invoiceSearcher.run({ tenantId: TENANT, onlyOverdue: 'true' });

      expect(result.total).toBe(2);
      expect(result.invoices.map((i) => i.code)).toEqual(['FCP000003', 'FCP000001']);
    });
  });

  describe('SupplierBalanceSearcher', () => {
    it('calculates aging buckets and balances per supplier and global totals', async () => {
      const result = await balanceSearcher.run({ tenantId: TENANT });

      expect(result.total).toBe(2);
      const alpha = result.suppliers.find((s) => s.supplier.id === SUPPLIER_A);
      const beta = result.suppliers.find((s) => s.supplier.id === SUPPLIER_B);

      expect(alpha?.balance).toBe(300);
      expect(alpha?.overdue).toBe(100);
      expect(alpha?.aging).toEqual({
        current: 200,
        days1To30: 100,
        days31To60: 0,
        days61To90: 0,
        over90: 0,
        total: 300,
      });

      expect(beta?.balance).toBe(300);
      expect(beta?.overdue).toBe(300);

      expect(result.totals).toEqual({
        current: 200,
        days1To30: 400,
        days31To60: 0,
        days61To90: 0,
        over90: 0,
        total: 600,
      });
    });

    it('hides suppliers with zero balance when onlyWithBalance is true', async () => {
      // Registrar pago completo para Beta
      const payment = SupplierPayment.fromPrimitives({
        id: 'd3000000-0000-4000-8000-000000000001',
        tenantId: TENANT,
        code: 'PAG000001',
        supplierId: SUPPLIER_B,
        paymentDate: '2026-09-15',
        method: 'transfer',
        reference: null,
        notes: null,
        currency: 'USD',
        exchangeRate: null,
        baseCurrency: 'USD',
        baseExchangeRate: null,
        manualExchangeRate: false,
        amount: 300,
        amountVes: null,
        status: 'confirmed',
        confirmedAt: new Date('2026-09-15T12:00:00Z'),
        cancelledAt: null,
        createdAt: new Date('2026-09-15T12:00:00Z'),
        updatedAt: new Date('2026-09-15T12:00:00Z'),
        allocations: [{ id: 'd4000000-0000-4000-8000-000000000001', invoiceId: INVOICE_3, amount: 300, exchangeRate: null, exchangeDifference: null }],
      });
      await store.payments.save(payment);

      const result = await balanceSearcher.run({ tenantId: TENANT, onlyWithBalance: 'true' });
      expect(result.total).toBe(1);
      expect(result.suppliers[0].supplier.id).toBe(SUPPLIER_A);
    });
  });

  describe('SupplierStatementSearcher', () => {
    it('builds chronological statement movements with running balance matching invoice balance', async () => {
      // Registrar abono de 40 a FCP000001
      const payment = SupplierPayment.fromPrimitives({
        id: 'd3000000-0000-4000-8000-000000000002',
        tenantId: TENANT,
        code: 'PAG000002',
        supplierId: SUPPLIER_A,
        paymentDate: '2026-08-20',
        method: 'transfer',
        reference: 'ABONO-1',
        notes: null,
        currency: 'USD',
        exchangeRate: null,
        baseCurrency: 'USD',
        baseExchangeRate: null,
        manualExchangeRate: false,
        amount: 40,
        amountVes: null,
        status: 'confirmed',
        confirmedAt: new Date('2026-08-20T12:00:00Z'),
        cancelledAt: null,
        createdAt: new Date('2026-08-20T12:00:00Z'),
        updatedAt: new Date('2026-08-20T12:00:00Z'),
        allocations: [{ id: 'd4000000-0000-4000-8000-000000000002', invoiceId: INVOICE_1, amount: 40, exchangeRate: null, exchangeDifference: null }],
      });
      await store.payments.save(payment);

      const statement = await statementSearcher.run({ tenantId: TENANT, supplierId: SUPPLIER_A });

      expect(statement.movements).toHaveLength(3);
      // Movimiento 1: FCP000001 (10-ago) -> cargo +100, saldo 100
      expect(statement.movements[0]).toMatchObject({
        type: 'invoice',
        code: 'FCP000001',
        debit: 100,
        credit: 0,
        balance: 100,
      });
      // Movimiento 2: PAG000002 (20-ago) -> abono 40, saldo 60
      expect(statement.movements[1]).toMatchObject({
        type: 'payment',
        code: 'PAG000002',
        debit: 0,
        credit: 40,
        balance: 60,
      });
      // Movimiento 3: FCP000002 (25-ago) -> cargo +200, saldo 260
      expect(statement.movements[2]).toMatchObject({
        type: 'invoice',
        code: 'FCP000002',
        debit: 200,
        credit: 0,
        balance: 260,
      });

      // El balance final del estado de cuenta coincide con el saldo de Alpha (100 - 40 + 200 = 260)
      expect(statement.summary.balance).toBe(260);
      expect(statement.movements[statement.movements.length - 1].balance).toBe(statement.summary.balance);
    });
  });
});
