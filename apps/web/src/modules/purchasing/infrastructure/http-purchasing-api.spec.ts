import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessError } from '../../access/domain/access-error';
import { HttpPurchasingApi } from './http-purchasing-api';

const api = new HttpPurchasingApi('http://api');

function respond(status: number, body?: unknown) {
  // Una respuesta nueva en cada llamada: el cuerpo de un Response solo se lee una vez.
  const fetchMock = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    );
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('HttpPurchasingApi', () => {
  it('creates a receipt for its order and edits a draft without moving it to another', async () => {
    const fetchMock = respond(201);
    const input = { date: null, notes: null, exchangeRate: null, lines: [{ orderLineId: 'l1', quantity: 4 }] };

    await api.createReceipt('t', 'o1', input);
    await api.updateReceipt('t', 'r1', input);

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, JSON.parse(init.body).orderId])).toEqual([
      ['http://api/api/v1/purchasing/receipts', 'POST', 'o1'],
      ['http://api/api/v1/purchasing/receipts/r1', 'PUT', undefined],
    ]);
  });

  // NaN viajaria como null y la API lo tomaria por un valor ausente.
  it('sends a quantity that is not a number as text, so the API names the field', async () => {
    const fetchMock = respond(201);

    await api.saveOrder('t', null, {
      supplierId: 's',
      warehouseId: 'w',
      date: null,
      expectedDate: null,
      notes: null,
      currency: 'EUR',
      exchangeRate: Number.NaN,
      lines: [{ itemId: 'i', unitId: 'u', quantity: Number.NaN, unitCost: 1 }],
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      currency: 'EUR',
      exchangeRate: 'NaN',
      lines: [{ quantity: 'NaN' }],
    });
  });

  it('turns an API failure into an error with its code, never its text', async () => {
    respond(409, { statusCode: 409, error: 'ReceiptExceedsPendingError', message: 'has 6 pending' });

    const failure = await api.confirmReceipt('t', 'r1').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AccessError);
    expect(failure).toMatchObject({ kind: 'conflict', code: 'ReceiptExceedsPendingError' });
  });

  // Los esquemas de consulta son estrictos: un filtro vacio seria un 400.
  it('sends only the filters that carry a value', async () => {
    const fetchMock = respond(200, { incoming: [], total: 0, limit: 20, offset: 0, hasMore: false });

    await api.searchIncoming('t', { q: '', warehouseId: 'w 1', limit: 20, offset: 0 });

    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/purchasing/incoming?warehouseId=w+1&limit=20&offset=0');
  });

  it('walks every page to fill a selector with all the suppliers', async () => {
    const supplier = (id: string) => ({
      id,
      code: id,
      name: id,
      fiscalId: null,
      email: null,
      phone: null,
      address: null,
      paymentTermDays: 0,
      isActive: true,
    });
    const pages = [
      { suppliers: [supplier('s1')], total: 2, limit: 50, offset: 0, hasMore: true },
      { suppliers: [supplier('s2')], total: 2, limit: 50, offset: 1, hasMore: false },
    ];
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(pages.shift()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const suppliers = await api.allSuppliers('t');

    expect(suppliers.map((row) => row.id)).toEqual(['s1', 's2']);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api/api/v1/purchasing/suppliers?limit=50&offset=0',
      'http://api/api/v1/purchasing/suppliers?limit=50&offset=1',
    ]);
  });
});
