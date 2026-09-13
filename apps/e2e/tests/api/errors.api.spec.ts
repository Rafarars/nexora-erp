import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const LOGIN = '/api/v1/auth/login';
const PASSWORD = 'Nexora-2026!';
const GLOBEX = '22222222-2222-4222-8222-222222222222';
const GLOBEX_ADMIN_ROLE = 'b0000000-0000-4000-8000-000000000001';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i;

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function tokenFor(request: APIRequestContext, email: string, password = PASSWORD) {
  return (await (await request.post(LOGIN, { data: { email, password } })).json()).token as string;
}

// Cada prueba crea su propia cuenta: desactivar una del seed tumbaria al resto.
async function aFreshAccount(request: APIRequestContext) {
  const admin = await tokenFor(request, 'ana@acme.com');
  const account = {
    email: `errores-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@acme.com`,
    password: 'a-long-password',
  };

  await request.post('/api/v1/users', { headers: auth(admin), data: { ...account, name: 'Errores' } });

  const { users } = await (await request.get('/api/v1/users', { headers: auth(admin) })).json();
  const userId = users.find((user: { email: string }) => user.email === account.email).userId;

  return { ...account, userId, admin };
}

test.describe('error responses never expose internal identifiers', () => {
  // El mensaje de los errores de dominio llevaba UUID de personas y empresas, y a veces
  // devolvia lo que habia mandado quien llama. Ahora solo sale el mensaje publico.
  test('across not found, conflict, invalid input and inactive access', async ({ request }) => {
    const admin = await tokenFor(request, 'ana@acme.com');
    const account = await aFreshAccount(request);
    const staleToken = await tokenFor(request, account.email, account.password);

    await request.put(`/api/v1/users/${account.userId}/status`, {
      headers: auth(admin),
      data: { active: false },
    });

    const responses = {
      'switch into a foreign tenant': await request.post('/api/v1/auth/switch-tenant', {
        headers: auth(admin),
        data: { tenantId: GLOBEX },
      }),
      'rewrite a foreign role': await request.put(`/api/v1/roles/${GLOBEX_ADMIN_ROLE}`, {
        headers: auth(admin),
        data: { name: 'Colado', permissions: [] },
      }),
      'duplicate role name': await request.post('/api/v1/roles', {
        headers: auth(admin),
        data: { name: 'Administrador', permissions: [] },
      }),
      'malformed identifier': await request.put('/api/v1/roles/no-es-un-uuid', {
        headers: auth(admin),
        data: { name: 'x', permissions: [] },
      }),
      'session of a deactivated person': await request.get('/api/v1/auth/me', {
        headers: auth(staleToken),
      }),
      'sign in to a revoked company': await request.post(LOGIN, {
        data: { email: account.email, password: account.password, tenantSlug: 'acme' },
      }),
    };

    for (const [scenario, response] of Object.entries(responses)) {
      const body = await response.text();

      expect(response.ok(), scenario).toBe(false);
      expect(body, scenario).not.toMatch(UUID);
      expect(body, scenario).not.toMatch(/[<>]/);
      expect(body, scenario).not.toContain('no-es-un-uuid');
    }
  });

  test('validation errors name the fields instead of returning the validator text', async ({
    request,
  }) => {
    const response = await request.post('/api/v1/users', {
      headers: auth(await tokenFor(request, 'ana@acme.com')),
      data: { email: 'corta@acme.com', password: 'x', name: 'Corta' },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('ValidationError');
    expect(body.fields).toContain('password');
    expect(JSON.stringify(body)).not.toContain('Too small');
  });

  test('a person with the right password but no active access is told so', async ({ request }) => {
    const account = await aFreshAccount(request);

    await request.put(`/api/v1/users/${account.userId}/status`, {
      headers: auth(account.admin),
      data: { active: false },
    });

    const withPassword = await request.post(LOGIN, { data: { email: account.email, password: account.password } });
    const withoutPassword = await request.post(LOGIN, { data: { email: account.email, password: 'wrong-pass' } });

    expect((await withPassword.json()).error).toBe('NoActiveMembershipError');
    // Sin la contrasena sigue sin saberse nada de la cuenta.
    expect((await withoutPassword.json()).error).toBe('InvalidCredentialsError');
  });
});

test.describe('PUT /api/v1/auth/email', () => {
  test('changes your own email and the old one stops working', async ({ request }) => {
    const account = await aFreshAccount(request);
    const token = await tokenFor(request, account.email, account.password);
    const newEmail = `nuevo-${Date.now()}@acme.com`;

    const response = await request.put('/api/v1/auth/email', {
      headers: auth(token),
      data: { current: account.password, email: newEmail },
    });

    expect(response.status()).toBe(200);
    expect((await request.post(LOGIN, { data: { email: newEmail, password: account.password } })).status()).toBe(200);
    expect((await request.post(LOGIN, { data: account })).status()).toBe(401);
  });

  test('refuses without the current password', async ({ request }) => {
    const account = await aFreshAccount(request);
    const token = await tokenFor(request, account.email, account.password);

    const response = await request.put('/api/v1/auth/email', {
      headers: auth(token),
      data: { current: 'not-the-password', email: `otro-${Date.now()}@acme.com` },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe('WrongCurrentPasswordError');
  });

  test('refuses an email that another account uses', async ({ request }) => {
    const account = await aFreshAccount(request);
    const token = await tokenFor(request, account.email, account.password);

    const response = await request.put('/api/v1/auth/email', {
      headers: auth(token),
      data: { current: account.password, email: 'ana@acme.com' },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe('EmailAlreadyInUseError');
  });
});
