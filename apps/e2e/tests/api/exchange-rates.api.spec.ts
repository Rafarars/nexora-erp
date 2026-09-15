import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { auth, tokenFor } from '../../support/inventory-fixtures.js';

const RATES = '/api/v1/company/exchange-rates';

interface CurrentRate {
  currency: string;
  rate: number | null;
  rateDate: string | null;
}

// Initech no trae tasas del seed. Estas pruebas usan fechas de 2001 y la de la pantalla, de 2002, asi
// que no se leen entre si. Cargar otra vez la misma tasa la corrige: repetir la suite sin resembrar da
// lo mismo. Se pide siempre la serie legal: otra prueba cambia la serie de Initech en sus parametros.
// En fila, porque una desactiva lo que otra lee.
test.describe.configure({ mode: 'serial' });

const record = (request: APIRequestContext, token: string, data: object) =>
  request.put(RATES, { headers: auth(token), data: { currency: 'USD', type: 'legal', source: 'BCV', ...data } });

const board = async (request: APIRequestContext, token: string, query: Record<string, string>) =>
  (await request.get(`${RATES}?${new URLSearchParams({ type: 'legal', ...query })}`, { headers: auth(token) })).json();

const dollarOn = async (request: APIRequestContext, token: string, date: string): Promise<CurrentRate> =>
  (await board(request, token, { date })).current.find((current: CurrentRate) => current.currency === 'USD');

test.describe('exchange rates', () => {
  test('a document day uses its own rate or the last one before it, never a later one', async ({ request }) => {
    const token = await tokenFor(request, 'dora@initech.com');

    for (const [rateDate, rate] of [['2001-03-01', 10], ['2001-03-05', 12], ['2001-03-09', 14]] as const) {
      expect((await record(request, token, { rateDate, rate })).status()).toBe(200);
    }

    expect(await dollarOn(request, token, '2001-03-05')).toEqual({ currency: 'USD', name: 'Dólar estadounidense', rate: 12, rateDate: '2001-03-05' });
    expect(await dollarOn(request, token, '2001-03-07')).toMatchObject({ rate: 12, rateDate: '2001-03-05' });
    expect(await dollarOn(request, token, '2001-02-28')).toMatchObject({ rate: null, rateDate: null });

    const { rates } = await board(request, token, { currency: 'USD', from: '2001-03-01', to: '2001-03-31' });
    expect(rates.map((rate: { rateDate: string; rate: number }) => [rate.rateDate, rate.rate])).toEqual([
      ['2001-03-09', 14],
      ['2001-03-05', 12],
      ['2001-03-01', 10],
    ]);
  });

  test('recording the same currency, day and type again corrects it instead of adding another', async ({ request }) => {
    const token = await tokenFor(request, 'dora@initech.com');
    const { id } = await (await record(request, token, { rateDate: '2001-04-02', rate: 20 })).json();

    expect(await (await record(request, token, { rateDate: '2001-04-02', rate: 20.5, source: null })).json()).toEqual({ id });
    expect((await board(request, token, { from: '2001-04-02', to: '2001-04-02' })).rates).toEqual([
      { id, currency: 'USD', rateDate: '2001-04-02', type: 'legal', rate: 20.5, source: null, isActive: true },
    ]);
  });

  test('a deactivated rate stops applying, and reactivating it brings it back', async ({ request }) => {
    const token = await tokenFor(request, 'dora@initech.com');
    await record(request, token, { rateDate: '2001-05-01', rate: 30 });
    const { id } = await (await record(request, token, { rateDate: '2001-05-07', rate: 31 })).json();
    const status = (active: boolean) => request.put(`${RATES}/${id}/status`, { headers: auth(token), data: { active } });

    try {
      expect((await status(false)).status()).toBe(200);
      expect(await dollarOn(request, token, '2001-05-08')).toMatchObject({ rate: 30, rateDate: '2001-05-01' });
    } finally {
      expect((await status(true)).status()).toBe(200);
    }

    expect(await dollarOn(request, token, '2001-05-08')).toMatchObject({ rate: 31, rateDate: '2001-05-07' });
  });

  test('explains every invalid rate and filter without recording anything', async ({ request }) => {
    const token = await tokenFor(request, 'dora@initech.com');
    const attempt = async (data: object) => {
      const response = await record(request, token, { rateDate: '2001-06-01', rate: 5, ...data });

      return { status: response.status(), error: (await response.json()).error };
    };

    expect(await attempt({ currency: 'VES' })).toEqual({ status: 400, error: 'LocalCurrencyRateError' });
    expect(await attempt({ currency: 'XYZ' })).toEqual({ status: 400, error: 'UnknownCurrencyError' });
    expect(await attempt({ rate: 0 })).toEqual({ status: 400, error: 'InvalidExchangeRateError' });
    expect(await attempt({ rate: 5.123456789 })).toEqual({ status: 400, error: 'InvalidExchangeRateError' });
    expect(await attempt({ rateDate: '2001-02-30' })).toEqual({ status: 400, error: 'InvalidRateDateError' });
    expect(await attempt({ type: 'paralela' })).toEqual({ status: 400, error: 'InvalidRateTypeError' });
    expect((await attempt({ rate: '5,5' })).status).toBe(400);

    const badFilter = await request.get(`${RATES}?from=01-06-2001`, { headers: auth(token) });
    expect(badFilter.status()).toBe(400);
    expect((await badFilter.json()).error).toBe('InvalidRateDateError');
    expect((await board(request, token, { from: '2001-06-01', to: '2001-06-01' })).rates).toEqual([]);
  });

  test('a read-only role sees the rates but cannot change them, and nobody reads them without a session', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');
    const response = await request.get(RATES, { headers: auth(token) });
    const { rates, current } = await response.json();

    expect(response.status()).toBe(200);
    expect(rates).toEqual(expect.arrayContaining([expect.objectContaining({ currency: 'EUR', rateDate: '2026-09-11', type: 'legal', rate: 175.05, source: 'BCV' })]));
    expect(current.map((rate: CurrentRate) => rate.currency)).toEqual(['USD', 'EUR']);

    expect((await record(request, token, { rateDate: '2001-07-02', rate: 5 })).status()).toBe(403);
    expect((await request.put(`${RATES}/${rates[0].id}/status`, { headers: auth(token), data: { active: false } })).status()).toBe(403);
    expect((await request.get(RATES)).status()).toBe(401);
  });
});
