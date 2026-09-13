import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessError } from '../../access/domain/access-error';
import { HttpPurchasingApi } from './http-purchasing-api';

const api = new HttpPurchasingApi('http://api');

function respond(status: number, body?: unknown) {
  // Una respuesta nueva en cada llamada: el cuerpo de un Response solo se lee una vez.
  const fetchMock = vi.fn().mockImplementation(async () =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('HttpPurchasingApi', () => {
  it('creates a receipt for its order and edits a draft without moving it to another', async () => {
    const fetchMock = respond(201);
    const input = { date: null, notes: null, lines: [{ orderLineId: 'l1', quantity: 4 }] };

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

    await api.saveOrder('t', null, { supplierId: 's', warehouseId: 'w', date: null, expectedDate: null, notes: null, lines: [{ itemId: 'i', unitId: 'u', quantity: Number.NaN, unitCost: 1 }] });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).lines[0].quantity).toBe('NaN');
  });

  it('turns an API failure into an error with its code, never its text', async () => {
    respond(409, { statusCode: 409, error: 'ReceiptExceedsPendingError', message: 'has 6 pending' });

    const failure = await api.confirmReceipt('t', 'r1').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AccessError);
    expect(failure).toMatchObject({ kind: 'conflict', code: 'ReceiptExceedsPendingError' });
  });

  it('filters the goods in transit by warehouse', async () => {
    const fetchMock = respond(200, { incoming: [] });

    await api.searchIncoming('t', 'w 1');

    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/purchasing/incoming?warehouseId=w%201');
  });
});
