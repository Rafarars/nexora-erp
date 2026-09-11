import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const LOGIN = '/api/v1/auth/login';
const USERS = '/api/v1/users';
const ASSIGNMENTS = '/api/v1/roles/assignments';

const PASSWORD = 'Nexora-2026!';
const GLOBEX = '22222222-2222-4222-8222-222222222222';
const ACME_ADMIN_ROLE = 'a0000000-0000-4000-8000-000000000001';
const GLOBEX_ADMIN_ROLE = 'b0000000-0000-4000-8000-000000000001';

// Administradora de Acme: puede todo DENTRO de Acme.
const ACME_ADMIN = { email: 'ana@acme.com', password: PASSWORD };
// Solo lectura en Acme, administradora en Globex: el mismo correo, distinto poder.
const ACCOUNTANT = { email: 'contador@externo.com', password: PASSWORD };

async function tokenFor(
  request: APIRequestContext,
  credentials: { email: string; password: string },
): Promise<string> {
  const { token } = await (await request.post(LOGIN, { data: credentials })).json();

  return token;
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

test.describe('the guard denies by default', () => {
  test('rejects a request with no session', async ({ request }) => {
    expect((await request.get(USERS)).status()).toBe(401);
  });

  test('rejects a forged token', async ({ request }) => {
    const response = await request.get(USERS, { headers: auth('not.a.token') });

    expect(response.status()).toBe(401);
  });

  test('lets a public endpoint through without a session', async ({ request }) => {
    expect((await request.get('/health')).status()).toBe(200);
  });
});

test.describe('permissions decide what a session can do', () => {
  test('allows an administrator, who lists no permissions at all', async ({ request }) => {
    const response = await request.get(USERS, { headers: auth(await tokenFor(request, ACME_ADMIN)) });

    expect(response.status()).toBe(200);
    expect((await response.json()).users.length).toBeGreaterThan(0);
  });

  test('allows a permission the role actually grants', async ({ request }) => {
    // El contador entra a Acme con el rol de solo consulta.
    const response = await request.get(USERS, { headers: auth(await tokenFor(request, ACCOUNTANT)) });

    expect(response.status()).toBe(200);
  });

  // Lo mismo que puede leer, no puede escribirlo: el permiso es por accion.
  test('answers 403 when the role does not grant the permission', async ({ request }) => {
    const response = await request.post(USERS, {
      headers: auth(await tokenFor(request, ACCOUNTANT)),
      data: { email: 'nueva@acme.com', password: 'a-long-password', name: 'Nueva' },
    });

    expect(response.status()).toBe(403);
  });

  test('lets the administrator do what the read-only role cannot', async ({ request }) => {
    const response = await request.post(USERS, {
      headers: auth(await tokenFor(request, ACME_ADMIN)),
      data: {
        email: `alta-${Date.now()}@acme.com`,
        password: 'a-long-password',
        name: 'Persona Nueva',
      },
    });

    expect(response.status()).toBe(201);
  });
});

test.describe('the tenant comes from the token, never from the request', () => {
  // La prueba que resume el hito: el contador manda datos de Globex con una sesion de
  // Acme, y el sistema lo trata como si Globex no existiera.
  test('cannot reach another tenant by sending its identifiers', async ({ request }) => {
    const token = await tokenFor(request, ACCOUNTANT);

    const response = await request.post(ASSIGNMENTS, {
      headers: auth(token),
      data: { userId: 'c0000000-0000-4000-8000-000000000003', roleId: GLOBEX_ADMIN_ROLE },
    });

    // 403 porque el rol de consulta no puede asignar; ni siquiera llega a mirar Globex.
    expect(response.status()).toBe(403);
  });

  test('a role of another tenant does not exist, even for an administrator', async ({ request }) => {
    const token = await tokenFor(request, ACME_ADMIN);

    const response = await request.post(ASSIGNMENTS, {
      headers: auth(token),
      data: { userId: 'c0000000-0000-4000-8000-000000000001', roleId: GLOBEX_ADMIN_ROLE },
    });

    // 404 y no 403: confirmar que el rol existe ya seria informacion de otra empresa.
    expect(response.status()).toBe(404);
  });

  test('the same person sees different people depending on the active tenant', async ({
    request,
  }) => {
    const acme = await request.get(USERS, { headers: auth(await tokenFor(request, ACCOUNTANT)) });
    const acmeEmails = (await acme.json()).users.map((user: { email: string }) => user.email);

    const switched = await request.post('/api/v1/auth/switch-tenant', {
      headers: auth(await tokenFor(request, ACCOUNTANT)),
      data: { tenantId: GLOBEX },
    });
    const globexToken = (await switched.json()).token;

    const globex = await request.get(USERS, { headers: auth(globexToken) });
    const globexEmails = (await globex.json()).users.map((user: { email: string }) => user.email);

    expect(acmeEmails).toContain('ana@acme.com');
    expect(globexEmails).not.toContain('ana@acme.com');
    expect(globexEmails).toContain('beto@globex.com');
  });

  // La defensa esta en que el DTO no acepta tenantId y el controlador lo toma de la
  // sesion. Sin esta prueba, quitar cualquiera de las dos cosas pasaria inadvertido.
  test('ignores a tenantId sent in the body', async ({ request }) => {
    const email = `colado-${Date.now()}@acme.com`;

    const created = await request.post(USERS, {
      headers: auth(await tokenFor(request, ACME_ADMIN)),
      data: {
        email,
        password: 'a-long-password',
        name: 'Colado',
        tenantId: GLOBEX,
      },
    });

    expect(created.status()).toBe(201);

    // Si el cuerpo hubiera mandado, esta persona no estaria en Acme.
    const listed = await request.get(USERS, { headers: auth(await tokenFor(request, ACME_ADMIN)) });

    expect((await listed.json()).users.map((user: { email: string }) => user.email)).toContain(
      email,
    );
  });

  // Crea su propia persona en vez de tocar la del seed: darle un rol al contador lo
  // convertiria en administrador y las pruebas que esperan un 403 suyo dejarian de
  // valer. Cada prueba se lleva su estado.
  test('assigning a role of the active tenant works', async ({ request }) => {
    const token = await tokenFor(request, ACME_ADMIN);
    const email = `con-rol-${Date.now()}@acme.com`;

    await request.post(USERS, {
      headers: auth(token),
      data: { email, password: 'a-long-password', name: 'Con Rol' },
    });

    const listed = await request.get(USERS, { headers: auth(token) });
    const created = (await listed.json()).users.find(
      (user: { email: string }) => user.email === email,
    );

    const response = await request.post(ASSIGNMENTS, {
      headers: auth(token),
      data: { userId: created.userId, roleId: ACME_ADMIN_ROLE },
    });

    expect(response.status()).toBe(200);
  });
});
