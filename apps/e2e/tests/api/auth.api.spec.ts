import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const LOGIN = '/api/v1/auth/login';
const SWITCH = '/api/v1/auth/switch-tenant';

const PASSWORD = 'Nexora-2026!';
const ACME = '11111111-1111-4111-8111-111111111111';
const GLOBEX = '22222222-2222-4222-8222-222222222222';

// El contador trabaja para las dos empresas con un solo correo.
const ACCOUNTANT = { email: 'contador@externo.com', password: PASSWORD };
const ACME_ADMIN = { email: 'ana@acme.com', password: PASSWORD };

function payloadOf(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

test.describe('POST /api/v1/auth/login', () => {
  test('returns a session for valid credentials', async ({ request }) => {
    const response = await request.post(LOGIN, { data: ACME_ADMIN });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.user.email).toBe('ana@acme.com');
    expect(body.tenant.name).toBe('Acme Industrial');
    expect(body.token).toBeTruthy();
    expect(body.expiresInSeconds).toBeGreaterThan(0);
  });

  // El aislamiento empieza aqui: la empresa activa la firma el servidor.
  test('puts the active tenant inside the signed token', async ({ request }) => {
    const { token } = await (await request.post(LOGIN, { data: ACME_ADMIN })).json();

    expect(payloadOf(token).tenantId).toBe(ACME);
  });

  test('never returns the password hash', async ({ request }) => {
    const body = await (await request.post(LOGIN, { data: ACME_ADMIN })).text();

    expect(body).not.toContain('$argon2');
    expect(body).not.toContain('passwordHash');
  });

  test('marks an administrator as granting everything', async ({ request }) => {
    const body = await (await request.post(LOGIN, { data: ACME_ADMIN })).json();

    expect(body.grantsAll).toBe(true);
  });

  test('lists every tenant a person can reach', async ({ request }) => {
    const body = await (await request.post(LOGIN, { data: ACCOUNTANT })).json();

    expect(body.availableTenants.map((tenant: { slug: string }) => tenant.slug).sort()).toEqual([
      'acme',
      'globex',
    ]);
  });

  test('rejects a wrong password with 401', async ({ request }) => {
    const response = await request.post(LOGIN, {
      data: { email: 'ana@acme.com', password: 'wrong-password' },
    });

    expect(response.status()).toBe(401);
  });

  // Un correo que no existe y una contrasena mala responden IGUAL: si difirieran,
  // se podria averiguar que cuentas estan registradas.
  test('does not reveal whether the email exists', async ({ request }) => {
    // Un correo distinto en cada corrida: el contador de intentos fallidos vive en la
    // API y sobrevive entre corridas, y uno fijo acabaria bloqueado (429).
    const unknown = await request.post(LOGIN, {
      data: { email: `nadie-${Date.now()}@acme.com`, password: PASSWORD },
    });
    const wrongPassword = await request.post(LOGIN, {
      data: { email: 'ana@acme.com', password: 'wrong-password' },
    });

    expect(unknown.status()).toBe(wrongPassword.status());
    expect(await unknown.text()).toBe(await wrongPassword.text());
  });

  test('rejects a tenant the person does not belong to', async ({ request }) => {
    const response = await request.post(LOGIN, {
      data: { ...ACME_ADMIN, tenantSlug: 'globex' },
    });

    expect(response.status()).toBe(401);
  });

  // El dominio lanza InvalidArgumentError y el filtro lo traduce, no un 500.
  test('answers 400 to a malformed body', async ({ request }) => {
    const response = await request.post(LOGIN, { data: {} });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe('ValidationError');
  });
});

// Cada prueba crea su propia cuenta: bloquear una del seed tumbaria al resto de la suite.
async function aFreshAccount(request: APIRequestContext): Promise<{ email: string; password: string }> {
  const { token } = await (await request.post(LOGIN, { data: ACME_ADMIN })).json();
  const account = {
    email: `intentos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@acme.com`,
    password: 'a-long-password',
  };

  await request.post('/api/v1/users', {
    headers: { authorization: `Bearer ${token}` },
    data: { ...account, name: 'Intentos' },
  });

  return account;
}

test.describe('Brute force and timing', () => {
  test('locks an account after five failed attempts, even for the right password', async ({
    request,
  }) => {
    const account = await aFreshAccount(request);

    for (let i = 0; i < 5; i++) {
      const failed = await request.post(LOGIN, { data: { ...account, password: `wrong-${i}` } });
      expect(failed.status()).toBe(401);
    }

    const locked = await request.post(LOGIN, { data: account });

    expect(locked.status()).toBe(429);
    expect(await locked.text()).not.toContain(account.email);
  });

  // La prueba que antes faltaba: comparar cuerpos no detecta que un correo inexistente
  // respondia diez veces mas rapido. Aqui se mide. Entre cada fallo de la cuenta real se
  // entra bien, para que el limite de intentos no la bloquee a mitad de la medicion.
  test('takes about as long to reject an unknown email as a registered one', async ({ request }) => {
    const account = await aFreshAccount(request);
    const timed = async (data: object) => {
      const start = performance.now();
      await request.post(LOGIN, { data });
      return performance.now() - start;
    };

    const registered: number[] = [];
    const unknown: number[] = [];

    for (let i = 0; i < 7; i++) {
      registered.push(await timed({ ...account, password: 'wrong-password' }));
      await request.post(LOGIN, { data: account });
      unknown.push(await timed({ email: `fantasma-${Date.now()}-${i}@acme.com`, password: 'x' }));
    }

    const median = (values: number[]) => [...values].sort((a, b) => a - b)[3];

    expect(median(unknown)).toBeGreaterThan(median(registered) * 0.5);
  });
});

test.describe('POST /api/v1/auth/switch-tenant', () => {
  async function sessionOf(
    request: import('@playwright/test').APIRequestContext,
    credentials: { email: string; password: string },
  ): Promise<{ token: string }> {
    return (await request.post(LOGIN, { data: credentials })).json();
  }

  test('reissues the token with the permissions of the destination tenant', async ({ request }) => {
    const { token } = await sessionOf(request, ACCOUNTANT);

    const response = await request.post(SWITCH, {
      headers: { authorization: `Bearer ${token}` },
      data: { tenantId: GLOBEX },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.tenant.name).toBe('Globex Servicios');
    expect(payloadOf(body.token).tenantId).toBe(GLOBEX);
    expect(body.token).not.toBe(token);
  });

  test('rejects a request with no token', async ({ request }) => {
    const response = await request.post(SWITCH, { data: { tenantId: GLOBEX } });

    expect(response.status()).toBe(401);
  });

  test('rejects a tampered token', async ({ request }) => {
    const { token } = await sessionOf(request, ACCOUNTANT);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ userId: 'someone', tenantId: GLOBEX }))
      .toString('base64url');

    const response = await request.post(SWITCH, {
      headers: { authorization: `Bearer ${header}.${forged}.${signature}` },
      data: { tenantId: GLOBEX },
    });

    expect(response.status()).toBe(401);
  });

  // Aislamiento: responde 404 y no 403, porque confirmar que la empresa existe ya
  // seria informacion sobre una empresa ajena.
  test('answers 404 when switching into a tenant the person does not belong to', async ({
    request,
  }) => {
    const { token } = await sessionOf(request, ACME_ADMIN);

    const response = await request.post(SWITCH, {
      headers: { authorization: `Bearer ${token}` },
      data: { tenantId: GLOBEX },
    });

    expect(response.status()).toBe(404);
  });
});
