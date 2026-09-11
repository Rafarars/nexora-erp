import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const LOGIN = '/api/v1/auth/login';
const ROLES = '/api/v1/roles';
const USERS = '/api/v1/users';
const PERMISSIONS = '/api/v1/permissions';
const ASSIGNMENTS = '/api/v1/roles/assignments';

const PASSWORD = 'Nexora-2026!';
const ACME_ADMIN = { email: 'ana@acme.com', password: PASSWORD };
const ACCOUNTANT = { email: 'contador@externo.com', password: PASSWORD };

async function tokenFor(
  request: APIRequestContext,
  credentials: { email: string; password: string },
): Promise<string> {
  return (await (await request.post(LOGIN, { data: credentials })).json()).token;
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function roleNamed(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<{ id: string; permissions: string[] }> {
  const { roles } = await (await request.get(ROLES, { headers: auth(token) })).json();

  return roles.find((role: { name: string }) => role.name === name);
}

test.describe('the permission catalog', () => {
  test('lists every permission with its description and module', async ({ request }) => {
    const response = await request.get(PERMISSIONS, {
      headers: auth(await tokenFor(request, ACME_ADMIN)),
    });

    expect(response.status()).toBe(200);

    const { permissions } = await response.json();
    expect(permissions.length).toBeGreaterThan(0);
    expect(permissions[0]).toHaveProperty('description');
    expect(permissions[0]).toHaveProperty('module');
  });

  test('is not reachable without the right permission', async ({ request }) => {
    const response = await request.get(PERMISSIONS, {
      headers: auth(await tokenFor(request, ACCOUNTANT)),
    });

    expect(response.status()).toBe(403);
  });
});

test.describe('managing roles', () => {
  test('creates a role with the permissions checked', async ({ request }) => {
    const token = await tokenFor(request, ACME_ADMIN);
    const name = `Rol ${Date.now()}`;

    const created = await request.post(ROLES, {
      headers: auth(token),
      data: { name, permissions: ['access.users.search'] },
    });

    expect(created.status()).toBe(201);
    expect((await roleNamed(request, token, name)).permissions).toEqual(['access.users.search']);
  });

  test('rejects a name already used in the tenant', async ({ request }) => {
    const token = await tokenFor(request, ACME_ADMIN);

    const response = await request.post(ROLES, {
      headers: auth(token),
      data: { name: 'Administrador', permissions: [] },
    });

    expect(response.status()).toBe(409);
  });

  // Un permiso inventado no llega a la base: se rechaza contra el catalogo.
  test('rejects a permission that is not in the catalog', async ({ request }) => {
    const response = await request.post(ROLES, {
      headers: auth(await tokenFor(request, ACME_ADMIN)),
      data: { name: `Invalido ${Date.now()}`, permissions: ['ventas.borrar.todo'] },
    });

    expect(response.status()).toBe(400);
  });

  test('does not let a read-only role create roles', async ({ request }) => {
    const response = await request.post(ROLES, {
      headers: auth(await tokenFor(request, ACCOUNTANT)),
      data: { name: 'Colado', permissions: [] },
    });

    expect(response.status()).toBe(403);
  });
});

// La razon por la que el guardian consulta la base y no el token: quitar un permiso
// tiene efecto AHORA, no cuando caduque la sesion de quien lo perdio.
test.describe('changing a role takes effect immediately', () => {
  test('a person loses access the moment the permission is unchecked', async ({ request }) => {
    const admin = await tokenFor(request, ACME_ADMIN);
    const name = `Temporal ${Date.now()}`;

    await request.post(ROLES, {
      headers: auth(admin),
      data: { name, permissions: ['access.users.search'] },
    });
    const role = await roleNamed(request, admin, name);

    // Se crea una persona con ese rol y se comprueba que entra.
    const email = `temporal-${Date.now()}@acme.com`;
    await request.post(USERS, {
      headers: auth(admin),
      data: { email, password: 'a-long-password', name: 'Temporal', roleIds: [role.id] },
    });

    const token = await tokenFor(request, { email, password: 'a-long-password' });
    expect((await request.get(USERS, { headers: auth(token) })).status()).toBe(200);

    // El administrador desmarca la casilla.
    await request.put(`${ROLES}/${role.id}`, {
      headers: auth(admin),
      data: { name, permissions: [] },
    });

    // MISMO token, sin volver a entrar: ya no puede.
    expect((await request.get(USERS, { headers: auth(token) })).status()).toBe(403);
  });

  test('taking the role away also takes the access away', async ({ request }) => {
    const admin = await tokenFor(request, ACME_ADMIN);
    const name = `Retirable ${Date.now()}`;

    await request.post(ROLES, {
      headers: auth(admin),
      data: { name, permissions: ['access.users.search'] },
    });
    const role = await roleNamed(request, admin, name);

    const email = `retirable-${Date.now()}@acme.com`;
    await request.post(USERS, {
      headers: auth(admin),
      data: { email, password: 'a-long-password', name: 'Retirable', roleIds: [role.id] },
    });

    const listed = await (await request.get(USERS, { headers: auth(admin) })).json();
    const person = listed.users.find((user: { email: string }) => user.email === email);

    const token = await tokenFor(request, { email, password: 'a-long-password' });
    expect((await request.get(USERS, { headers: auth(token) })).status()).toBe(200);

    const revoked = await request.delete(ASSIGNMENTS, {
      headers: auth(admin),
      data: { userId: person.userId, roleId: role.id },
    });

    expect(revoked.status()).toBe(200);
    expect((await request.get(USERS, { headers: auth(token) })).status()).toBe(403);
  });
});
