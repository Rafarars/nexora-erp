import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { GLOBEX, ISOLATION_CASES } from '../../support/isolation-matrix.js';

const LOGIN = '/api/v1/auth/login';
const PASSWORD = 'Nexora-2026!';

async function tokenFor(request: APIRequestContext, email: string): Promise<string> {
  return (await (await request.post(LOGIN, { data: { email, password: PASSWORD } })).json()).token;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

// Lo que Globex tiene, visto por su propio administrador. Se fotografia antes y
// despues de cada ataque: un 404 que llega DESPUES de escribir tambien seria una fuga.
async function globexSnapshot(request: APIRequestContext) {
  const token = await tokenFor(request, 'beto@globex.com');
  const [users, roles] = await Promise.all([
    request.get('/api/v1/users', { headers: auth(token) }).then((r) => r.json()),
    request.get('/api/v1/roles', { headers: auth(token) }).then((r) => r.json()),
  ]);

  return { users, roles };
}

test.describe('Tenant isolation: Acme cannot reach Globex', () => {
  for (const attack of ISOLATION_CASES) {
    test(`an Acme administrator cannot ${attack.title}`, async ({ request }) => {
      const before = await globexSnapshot(request);
      // Ana es administradora de Acme: tiene todos los permisos, asi que un rechazo
      // no puede deberse a que le falte uno.
      const acmeAdmin = await tokenFor(request, 'ana@acme.com');

      const response = await request[attack.method](attack.path, {
        headers: auth(acmeAdmin),
        data: attack.body,
      });

      // 404 y no 403: confirmar que el recurso existe ya seria informacion de Globex.
      expect(response.status(), attack.route).toBe(404);
      expect(await response.text()).not.toContain('Globex');
      expect(await globexSnapshot(request)).toEqual(before);
    });
  }

  test('a person created in Acme never shows up in Globex', async ({ request }) => {
    const email = `solo-acme-${Date.now()}@acme.com`;
    const acmeAdmin = await tokenFor(request, 'ana@acme.com');

    await request.post('/api/v1/users', {
      headers: auth(acmeAdmin),
      data: { email, password: 'a-long-password', name: 'Solo Acme' },
    });

    const { users } = (await globexSnapshot(request)).users;
    expect(users.map((user: { email: string }) => user.email)).not.toContain(email);
  });

  // La misma persona en las dos empresas: sus permisos de Globex no la acompanan a Acme.
  test('an administrator of Globex is only a viewer in Acme', async ({ request }) => {
    const token = await tokenFor(request, 'contador@externo.com');

    const inAcme = await request.post('/api/v1/roles', {
      headers: auth(token),
      data: { name: `Colado ${Date.now()}`, permissions: [] },
    });
    expect(inAcme.status()).toBe(403);

    const switched = await request.post('/api/v1/auth/switch-tenant', {
      headers: auth(token),
      data: { tenantId: GLOBEX.tenantId },
    });
    const globexToken = (await switched.json()).token;

    const inGlobex = await request.post('/api/v1/roles', {
      headers: auth(globexToken),
      data: { name: `Propio ${Date.now()}`, permissions: [] },
    });
    expect(inGlobex.status()).toBe(201);
  });
});
