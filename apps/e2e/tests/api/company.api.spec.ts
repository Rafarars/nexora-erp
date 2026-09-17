import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { auth, tokenFor } from '../../support/inventory-fixtures.js';

const PROFILE = '/api/v1/company/profile';
const SETTINGS = '/api/v1/company/settings';
const CURRENCIES = '/api/v1/company/currencies';

// Lo que siembra el seed para todas las empresas.
const DEFAULTS = { baseCurrency: 'USD', secondaryCurrency: 'VES', timeZone: 'America/Caracas', amountDecimals: 2, priceDecimals: 6, rateType: 'legal', allowsRateOverride: true };

// Initech no tiene documentos y nadie mas trabaja en ella: sus datos y parametros se pueden cambiar
// y devolver sin pisar otra prueba. Cada prueba que la cambia la deja como estaba, y las de este
// archivo van en fila: en paralelo, una leeria lo que otra acaba de cambiar.
test.describe.configure({ mode: 'serial' });

const restore = async (request: APIRequestContext, token: string) => {
  expect((await request.put(SETTINGS, { headers: auth(token), data: DEFAULTS })).status()).toBe(200);
};

test.describe('company settings', () => {
  test('any member reads them, with today in the time zone of the company', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');
    const response = await request.get(SETTINGS, { headers: auth(token) });
    const caracasToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
    const before = caracasToday();

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      baseCurrency: { code: 'USD', symbol: '$' },
      secondaryCurrency: { code: 'VES' },
      dualCurrency: true,
      timeZone: 'America/Caracas',
      amountDecimals: 2,
      priceDecimals: 6,
      rateType: 'legal',
      allowsRateOverride: true,
    });
    // Solo a medianoche de Caracas puede cambiar el dia entre la peticion y esta linea.
    expect([before, caracasToday()]).toContain((await response.json()).today);
  });

  test('an administrator changes them and they apply at once', async ({ request }) => {
    const token = await tokenFor(request, 'dora@initech.com');

    try {
      const update = await request.put(SETTINGS, {
        headers: auth(token),
        data: { baseCurrency: 'eur', secondaryCurrency: null, timeZone: 'Europe/Madrid', amountDecimals: 3, priceDecimals: 4, rateType: 'manual', allowsRateOverride: false },
      });

      expect(update.status()).toBe(200);
      expect(await (await request.get(SETTINGS, { headers: auth(token) })).json()).toMatchObject({
        baseCurrency: { code: 'EUR' },
        secondaryCurrency: null,
        dualCurrency: false,
        timeZone: 'Europe/Madrid',
        amountDecimals: 3,
        priceDecimals: 4,
        rateType: 'manual',
        allowsRateOverride: false,
        today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()),
      });
    } finally {
      await restore(request, token);
    }
  });

  test('explains every invalid value without changing anything', async ({ request }) => {
    const token = await tokenFor(request, 'dora@initech.com');
    const attempt = async (overrides: object) => {
      const response = await request.put(SETTINGS, { headers: auth(token), data: { ...DEFAULTS, ...overrides } });

      return { status: response.status(), error: (await response.json()).error };
    };

    expect(await attempt({ timeZone: 'Marte/Olympus' })).toEqual({ status: 400, error: 'InvalidTimeZoneError' });
    expect(await attempt({ secondaryCurrency: 'XYZ' })).toEqual({ status: 400, error: 'UnknownCurrencyError' });
    expect(await attempt({ amountDecimals: 5 })).toEqual({ status: 400, error: 'InvalidDecimalPlacesError' });
    expect(await attempt({ rateType: 'paralela' })).toEqual({ status: 400, error: 'InvalidRateTypeError' });
    expect(await (await request.get(SETTINGS, { headers: auth(token) })).json()).toMatchObject({ timeZone: 'America/Caracas', amountDecimals: 2 });
  });

  // Acme ya confirmo documentos en dolares: su historico no puede pasar a decir euros.
  test('keeps the base currency of a company with confirmed documents', async ({ request }) => {
    const response = await request.put(SETTINGS, {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: { ...DEFAULTS, baseCurrency: 'EUR' },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('BaseCurrencyLockedError');
  });

  // Con menos decimales, las facturas de Acme con centimos ya no se podrian cobrar enteras.
  test('only lets the decimal places of a company with confirmed documents go up', async ({ request }) => {
    const token = await tokenFor(request, 'ana@acme.com');
    const response = await request.put(SETTINGS, { headers: auth(token), data: { ...DEFAULTS, amountDecimals: 0 } });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('DecimalPlacesLockedError');
    expect(await (await request.get(SETTINGS, { headers: auth(token) })).json()).toMatchObject({ amountDecimals: 2 });
  });

  test('a read-only role cannot change them, and nobody reads them without a session', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');

    expect((await request.put(SETTINGS, { headers: auth(token), data: DEFAULTS })).status()).toBe(403);
    expect((await request.get(SETTINGS)).status()).toBe(401);
    expect((await request.get(CURRENCIES)).status()).toBe(401);
  });

  test('lists the currencies of the system to any member', async ({ request }) => {
    const { currencies } = await (await request.get(CURRENCIES, { headers: auth(await tokenFor(request, 'contador@externo.com')) })).json();

    expect(currencies.map((currency: { code: string }) => currency.code)).toEqual(expect.arrayContaining(['USD', 'EUR', 'VES']));
  });
});

test.describe('company profile', () => {
  test('shows the data the company puts on its documents', async ({ request }) => {
    const response = await request.get(PROFILE, { headers: auth(await tokenFor(request, 'contador@externo.com')) });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ legalName: 'Acme Industrial, C.A.', fiscalId: 'J-40000001-2' });
  });

  test('an administrator edits it, and a read-only role cannot', async ({ request }) => {
    const dora = await tokenFor(request, 'dora@initech.com');
    const original = await (await request.get(PROFILE, { headers: auth(dora) })).json();

    try {
      const update = await request.put(PROFILE, {
        headers: auth(dora),
        data: { ...original, tradeName: 'Initech', fiscalId: 'j-40000003-9', email: 'administracion@initech.com' },
      });

      expect(update.status()).toBe(200);
      expect(await (await request.get(PROFILE, { headers: auth(dora) })).json()).toMatchObject({ tradeName: 'Initech', fiscalId: 'J-40000003-9' });
      expect((await request.put(PROFILE, { headers: auth(dora), data: { ...original, email: 'no-es-un-correo' } })).status()).toBe(400);
    } finally {
      await request.put(PROFILE, { headers: auth(dora), data: original });
    }

    expect((await request.put(PROFILE, { headers: auth(await tokenFor(request, 'contador@externo.com')), data: original })).status()).toBe(403);
  });
});
