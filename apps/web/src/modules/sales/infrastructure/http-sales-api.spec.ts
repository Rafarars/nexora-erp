import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpSalesApi } from './http-sales-api';

const api = new HttpSalesApi('http://api');

afterEach(() => vi.unstubAllGlobals());

const customer = (id: string) => ({
  id,
  code: id,
  name: id,
  fiscalId: null,
  email: null,
  phone: null,
  address: null,
  paymentTermDays: 0,
  creditLimit: null,
  priceListId: null,
  isActive: true,
});

describe('HttpSalesApi', () => {
  // Los esquemas de consulta son estrictos: un filtro vacio seria un 400.
  it('sends only the filters that carry a value', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ invoices: [], total: 0, limit: 20, offset: 0, hasMore: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.searchInvoices('t', { q: '', customerId: 'c 1', status: 'issued', from: '', to: '', limit: 20, offset: 0 });

    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/sales/invoices?customerId=c+1&status=issued&limit=20&offset=0');
  });

  it('walks every page to fill a selector with all the customers', async () => {
    const pages = [
      { customers: [customer('c1')], total: 2, limit: 50, offset: 0, hasMore: true },
      { customers: [customer('c2')], total: 2, limit: 50, offset: 1, hasMore: false },
    ];
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(pages.shift()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const customers = await api.allCustomers('t');

    expect(customers.map((row) => row.id)).toEqual(['c1', 'c2']);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api/api/v1/sales/customers?limit=50&offset=0',
      'http://api/api/v1/sales/customers?limit=50&offset=1',
    ]);
  });
});
