import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpReceivablesApi } from './http-receivables-api';

const api = new HttpReceivablesApi('http://api');

afterEach(() => vi.unstubAllGlobals());

const aging = { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0, total: 0 };

const balance = (id: string) => ({
  customer: { id, code: id, name: id, isActive: true },
  paymentTermDays: 0,
  creditLimit: null,
  balance: 0,
  overdue: 0,
  availableCredit: null,
  creditBlocked: false,
  aging,
});

describe('HttpReceivablesApi', () => {
  // Los esquemas de consulta son estrictos: un filtro vacio seria un 400.
  it('sends only the filters that carry a value', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ receivables: [], total: 0, limit: 20, offset: 0, hasMore: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.searchReceivables('t', { q: '', customerId: 'c 1', status: 'pending', from: '', to: '2026-01-31', onlyOverdue: 'true', limit: 20, offset: 0 });

    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/receivables/invoices?customerId=c+1&status=pending&to=2026-01-31&onlyOverdue=true&limit=20&offset=0');
  });

  it('asks the payments for one page at a time', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ payments: [], total: 0, limit: 20, offset: 20, hasMore: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.searchPayments('t', { q: 'trf', limit: 20, offset: 20 });

    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/receivables/payments?q=trf&limit=20&offset=20');
  });

  // El selector de cliente de los filtros tiene que ofrecer tambien a quien no debe nada.
  it('walks every page to fill a selector with all the customers, owing or not', async () => {
    const pages = [
      { customers: [balance('c1')], totals: aging, total: 2, limit: 50, offset: 0, hasMore: true },
      { customers: [balance('c2')], totals: aging, total: 2, limit: 50, offset: 1, hasMore: false },
    ];
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(pages.shift()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const customers = await api.allCustomers('t');

    expect(customers.map((row) => row.id)).toEqual(['c1', 'c2']);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api/api/v1/receivables/customers?onlyWithBalance=false&limit=50&offset=0',
      'http://api/api/v1/receivables/customers?onlyWithBalance=false&limit=50&offset=1',
    ]);
  });
});
