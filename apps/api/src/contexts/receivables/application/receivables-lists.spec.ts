import { describe, expect, it } from 'vitest';
import { InvalidUuidError } from '../../../shared/domain/uuid.vo.js';
import { ReceivableCustomerNotFoundError } from '../domain/errors/receivables.errors.js';
import { CUSTOMER, DOLLARS, INVOICE, OTHER_CUSTOMER, OTHER_INVOICE, TENANT_A, TENANT_B } from '../domain/testing/receivables.mother.js';
import { ReceivablesScenario, aReceivablesScenario } from './testing/receivables-scenario.js';

const THIRD_CUSTOMER = 'c3333333-3333-4333-8333-333333333333';
const THIRD_INVOICE = 'f3333333-3333-4333-8333-333333333333';
const PAID_INVOICE = 'f4444444-4444-4444-8444-444444444444';
const CANCELLED_INVOICE = 'f5555555-5555-4555-8555-555555555555';
const FOREIGN_CUSTOMER = 'c9999999-9999-4999-8999-999999999999';

// Hoy es el 15 de enero. Tres clientes deben algo: Delta 100 (vencio el 10), Sigma 30 (vence el 20)
// y Omega 50 (vencio el 14). Delta tiene ademas una cobrada y una anulada, que nunca se cobran.
function world(): ReceivablesScenario {
  const s = aReceivablesScenario();

  s.store.customer(TENANT_A, { id: CUSTOMER, code: 'CLI000001', name: 'Comercial Delta', paymentTermDays: 15, creditLimit: 500, isActive: true });
  s.store.customer(TENANT_A, { id: THIRD_CUSTOMER, code: 'CLI000003', name: 'Distribuidora Sigma', paymentTermDays: 30, creditLimit: null, isActive: true });
  s.store.customer(TENANT_A, { id: OTHER_CUSTOMER, code: 'CLI000002', name: 'Talleres Omega', paymentTermDays: 0, creditLimit: null, isActive: true });
  s.store.customer(TENANT_B, { id: FOREIGN_CUSTOMER, code: 'CLI000001', name: 'Ajena', paymentTermDays: 0, creditLimit: null, isActive: true });

  s.store.invoice(TENANT_A, { id: INVOICE, code: 'FAC000001', customerId: CUSTOMER, issueDate: '2025-12-26', dueDate: '2026-01-10', status: 'issued', total: 100, ...DOLLARS });
  s.store.invoice(TENANT_A, { id: OTHER_INVOICE, code: 'FAC000002', customerId: THIRD_CUSTOMER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'issued', total: 30, ...DOLLARS });
  s.store.invoice(TENANT_A, { id: THIRD_INVOICE, code: 'FAC000003', customerId: OTHER_CUSTOMER, issueDate: '2026-01-04', dueDate: '2026-01-14', status: 'issued', total: 50, ...DOLLARS });
  s.store.invoice(TENANT_A, { id: PAID_INVOICE, code: 'FAC000004', customerId: CUSTOMER, issueDate: '2026-01-02', dueDate: '2026-01-12', status: 'issued', total: 20, ...DOLLARS });
  s.store.invoice(TENANT_A, { id: CANCELLED_INVOICE, code: 'FAC000005', customerId: CUSTOMER, issueDate: '2026-01-02', dueDate: '2026-01-12', status: 'cancelled', total: 70, ...DOLLARS });

  return s;
}

// Cobra entera la factura de 20 de Delta y deja otra a medias, para tener los tres estados.
async function withPayments(s: ReceivablesScenario) {
  await s.createPayment.run({ tenantId: TENANT_A, customerId: CUSTOMER, method: 'transfer', reference: 'TRF-77', allocations: [{ invoiceId: PAID_INVOICE, amount: 20 }] });
  const [paid] = (await s.searchPayments.run({ tenantId: TENANT_A })).payments;
  await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: paid.id });

  await s.createPayment.run({ tenantId: TENANT_A, customerId: CUSTOMER, method: 'cash', reference: 'EFE-12', allocations: [{ invoiceId: INVOICE, amount: 40 }] });
  const partial = (await s.searchPayments.run({ tenantId: TENANT_A })).payments.find((row) => row.reference === 'EFE-12')!;
  await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: partial.id });

  // Un borrador de Sigma que todavia no toca ningun saldo.
  await s.createPayment.run({ tenantId: TENANT_A, customerId: THIRD_CUSTOMER, method: 'check', reference: 'CHQ-05', allocations: [{ invoiceId: OTHER_INVOICE, amount: 5 }] });

  return { paid, partial };
}

describe('searching the receivable invoices', () => {
  it('pages them and never shows a cancelled one', async () => {
    const s = world();

    expect(await s.searchReceivables.run({ tenantId: TENANT_A })).toMatchObject({ total: 4, limit: 20, offset: 0, hasMore: false });

    const first = await s.searchReceivables.run({ tenantId: TENANT_A, limit: 2 });
    const second = await s.searchReceivables.run({ tenantId: TENANT_A, limit: 2, offset: 2 });

    expect(first).toMatchObject({ total: 4, hasMore: true });
    expect(second.hasMore).toBe(false);
    // Las que vencen antes primero, sin repetir ninguna entre paginas.
    expect([...first.receivables, ...second.receivables].map((row) => row.code)).toEqual(['FAC000001', 'FAC000004', 'FAC000003', 'FAC000002']);
  });

  it('filters them by invoice code, customer name, due date and collection status', async () => {
    const s = world();
    await withPayments(s);

    expect((await s.searchReceivables.run({ tenantId: TENANT_A, q: 'fac000003' })).receivables.map((row) => row.id)).toEqual([THIRD_INVOICE]);
    expect((await s.searchReceivables.run({ tenantId: TENANT_A, q: 'TALLERES' })).receivables.map((row) => row.id)).toEqual([THIRD_INVOICE]);
    expect((await s.searchReceivables.run({ tenantId: TENANT_A, from: '2026-01-14' })).receivables.map((row) => row.code)).toEqual(['FAC000003', 'FAC000002']);
    expect((await s.searchReceivables.run({ tenantId: TENANT_A, to: '2026-01-10' })).receivables.map((row) => row.code)).toEqual(['FAC000001']);
    expect((await s.searchReceivables.run({ tenantId: TENANT_A, status: 'paid' })).receivables.map((row) => row.id)).toEqual([PAID_INVOICE]);
    expect((await s.searchReceivables.run({ tenantId: TENANT_A, status: 'partially_paid' })).receivables.map((row) => row.id)).toEqual([INVOICE]);
    expect((await s.searchReceivables.run({ tenantId: TENANT_A, status: 'pending' })).total).toBe(2);
  });

  // Vencida es la que paso su fecha y todavia debe algo: la cobrada entera ya no cuenta.
  it('keeps only what is overdue when it is asked for', async () => {
    const s = world();
    await withPayments(s);

    expect((await s.searchReceivables.run({ tenantId: TENANT_A, onlyOverdue: 'true' })).receivables.map((row) => row.code)).toEqual(['FAC000001', 'FAC000003']);
    expect((await s.searchReceivables.run({ tenantId: TENANT_A, onlyOverdue: 'false' })).total).toBe(4);
  });

  it('answers not found for a customer of another company and refuses a malformed one', async () => {
    const s = world();

    expect((await s.searchReceivables.run({ tenantId: TENANT_A, customerId: CUSTOMER })).total).toBe(2);
    await expect(s.searchReceivables.run({ tenantId: TENANT_A, customerId: FOREIGN_CUSTOMER })).rejects.toThrow(ReceivableCustomerNotFoundError);
  });

  // Un identificador mal formado es una peticion incorrecta, no un fallo del servidor: el formato
  // se comprueba antes de consultar, o PostgreSQL revienta y sale como error interno.
  it('refuses a malformed customer identifier instead of failing inside', async () => {
    const s = world();

    await expect(s.searchReceivables.run({ tenantId: TENANT_A, customerId: 'undefined' })).rejects.toThrow(InvalidUuidError);
    await expect(s.searchReceivables.run({ tenantId: TENANT_A, customerId: 'not-a-uuid' })).rejects.toThrow(InvalidUuidError);
  });
});

describe('searching the payments', () => {
  it('pages them and filters them by code, reference, customer, status and date', async () => {
    const s = world();
    const { paid, partial } = await withPayments(s);

    expect(await s.searchPayments.run({ tenantId: TENANT_A })).toMatchObject({ total: 3, limit: 20, offset: 0, hasMore: false });
    expect((await s.searchPayments.run({ tenantId: TENANT_A, limit: 2 })).hasMore).toBe(true);
    expect((await s.searchPayments.run({ tenantId: TENANT_A, limit: 2, offset: 2 })).payments).toHaveLength(1);

    expect((await s.searchPayments.run({ tenantId: TENANT_A, q: paid.code.toLowerCase() })).payments.map((row) => row.id)).toEqual([paid.id]);
    expect((await s.searchPayments.run({ tenantId: TENANT_A, q: 'efe-12' })).payments.map((row) => row.id)).toEqual([partial.id]);
    expect((await s.searchPayments.run({ tenantId: TENANT_A, customerId: THIRD_CUSTOMER })).total).toBe(1);
    expect((await s.searchPayments.run({ tenantId: TENANT_A, status: 'draft' })).payments.map((row) => row.reference)).toEqual(['CHQ-05']);
    expect((await s.searchPayments.run({ tenantId: TENANT_A, status: 'confirmed' })).total).toBe(2);
    expect((await s.searchPayments.run({ tenantId: TENANT_A, to: '2026-01-14' })).total).toBe(0);
  });

  // Cada cobro sigue trayendo el codigo y el vencimiento de las facturas que rebaja.
  it('keeps what each payment applies while it only reads the invoices of its page', async () => {
    const s = world();
    const { partial } = await withPayments(s);

    expect((await s.searchPayments.run({ tenantId: TENANT_A, q: 'efe-12' })).payments[0].allocations).toEqual([
      { invoiceId: INVOICE, invoiceCode: 'FAC000001', dueDate: '2026-01-10', currency: 'USD', amount: 40, exchangeRate: 36.5, exchangeDifference: 0 },
    ]);
    expect(partial.customer).toEqual({ id: CUSTOMER, code: 'CLI000001', name: 'Comercial Delta' });
  });

  it('answers not found for a customer of another company', async () => {
    const s = world();

    await expect(s.searchPayments.run({ tenantId: TENANT_A, customerId: FOREIGN_CUSTOMER })).rejects.toThrow(ReceivableCustomerNotFoundError);
    expect(await s.searchPayments.run({ tenantId: TENANT_B })).toMatchObject({ total: 0, payments: [] });
  });

  it('refuses a malformed customer identifier instead of failing inside', async () => {
    const s = world();

    await expect(s.searchPayments.run({ tenantId: TENANT_A, customerId: 'undefined' })).rejects.toThrow(InvalidUuidError);
    await expect(s.searchPayments.run({ tenantId: TENANT_A, customerId: 'not-a-uuid' })).rejects.toThrow(InvalidUuidError);
  });
});

describe('searching the customer balances', () => {
  it('pages them and leaves out whoever owes nothing unless it is asked for', async () => {
    const s = world();
    await withPayments(s);

    expect(await s.searchCustomerBalances.run({ tenantId: TENANT_A })).toMatchObject({ total: 3, limit: 20, offset: 0, hasMore: false });
    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A, limit: 2 })).customers.map((row) => row.customer.code)).toEqual(['CLI000001', 'CLI000003']);
    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A, limit: 2, offset: 2 })).customers.map((row) => row.customer.code)).toEqual(['CLI000002']);
    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A, q: 'sigma' })).customers.map((row) => row.customer.id)).toEqual([THIRD_CUSTOMER]);
    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A, q: 'CLI000002' })).total).toBe(1);
  });

  // Lo que la pantalla ensena arriba. Si los totales sumaran solo la pagina, la fila mentiria.
  it('adds up every customer the filter leaves, not the page it returns', async () => {
    const s = world();
    await withPayments(s);

    const page = await s.searchCustomerBalances.run({ tenantId: TENANT_A, limit: 2 });
    const inPage = page.customers.reduce((sum, row) => sum + row.balance, 0);

    expect(page.hasMore).toBe(true);
    expect(page.customers).toHaveLength(2);
    // Delta debe 60 de la parcial, Sigma 30 y Omega 50.
    expect(page.totals.total).toBe(140);
    expect(page.totals.total).toBeGreaterThan(inPage);
    expect(inPage).toBe(90);

    // Y con un filtro, suman lo que el filtro deja: solo Sigma.
    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A, q: 'sigma' })).totals.total).toBe(30);
  });

  it('shows whoever owes nothing when it is asked for', async () => {
    const s = world();

    s.store.customer(TENANT_A, { id: 'c8888888-8888-4888-8888-888888888888', code: 'CLI000008', name: 'Zafiro sin deuda', paymentTermDays: 0, creditLimit: null, isActive: true });

    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A })).total).toBe(3);
    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A, onlyWithBalance: 'false' })).total).toBe(4);
    // El que no debe nada no cambia los totales.
    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A, onlyWithBalance: 'false' })).totals.total).toBe(200);
  });
});
