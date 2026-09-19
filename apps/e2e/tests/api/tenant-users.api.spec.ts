import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const LOGIN = '/api/v1/auth/login';
const USERS = '/api/v1/users';
const PASSWORD = 'Nexora-2026!';
const ACME_ADMIN = { email: 'ana@acme.com', password: PASSWORD };
const ACCOUNTANT = { email: 'contador@externo.com', password: PASSWORD };
const ANA = 'c0000000-0000-4000-8000-000000000001';
const BETO = 'c0000000-0000-4000-8000-000000000002';
const ACME_VIEWER_ROLE = 'a0000000-0000-4000-8000-000000000002';
// Initech tiene UNA sola administradora, Dora: es donde se puede comprobar la ultima sin
// tocar Acme, que usan las demas pruebas.
const INITECH_ADMIN = { email: 'dora@initech.com', password: PASSWORD };
const DORA = 'c0000000-0000-4000-8000-000000000005';
const INITECH_ADMIN_ROLE = 'f0000000-0000-4000-8000-000000000001';
const ROLES = '/api/v1/roles';

async function tokenFor(request: APIRequestContext, credentials: { email: string; password: string }) {
  return (await (await request.post(LOGIN, { data: credentials })).json()).token as string;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

// Crea su propia persona: tocar las del seed contaminaria a las demas pruebas.
async function aFreshPerson(request: APIRequestContext, admin: string) {
  const email = `editable-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@acme.com`;
  const password = 'a-long-password';

  await request.post(USERS, { headers: auth(admin), data: { email, password, name: 'Editable' } });

  const { users } = await (await request.get(USERS, { headers: auth(admin) })).json();
  const person = users.find((user: { email: string }) => user.email === email);

  return { ...person, password, credentials: { email, password } } as {
    userId: string;
    email: string;
    password: string;
    credentials: { email: string; password: string };
  };
}

test.describe('an administrator edits someone else', () => {
  test('changes the name and the roles', async ({ request }) => {
    const admin = await tokenFor(request, ACME_ADMIN);
    const person = await aFreshPerson(request, admin);

    const response = await request.put(`${USERS}/${person.userId}`, {
      headers: auth(admin),
      data: { name: 'Nombre Nuevo', roleIds: [ACME_VIEWER_ROLE] },
    });

    expect(response.status()).toBe(200);

    const { users } = await (await request.get(USERS, { headers: auth(admin) })).json();
    const edited = users.find((user: { userId: string }) => user.userId === person.userId);
    expect(edited.name).toBe('Nombre Nuevo');
    expect(edited.roleIds).toEqual([ACME_VIEWER_ROLE]);
  });

  // La llave de la cuenta queda fuera: aunque el cuerpo traiga una contrasena, se ignora.
  test('cannot change the password of someone else', async ({ request }) => {
    const admin = await tokenFor(request, ACME_ADMIN);
    const person = await aFreshPerson(request, admin);

    await request.put(`${USERS}/${person.userId}`, {
      headers: auth(admin),
      data: { name: 'Editable', roleIds: [], password: 'hijacked-password' },
    });

    const withOld = await request.post(LOGIN, { data: { email: person.email, password: person.password } });
    const withNew = await request.post(LOGIN, { data: { email: person.email, password: 'hijacked-password' } });

    expect(withOld.status()).toBe(200);
    expect(withNew.status()).toBe(401);
  });

  // Aislamiento: Beto es de Globex. Para Acme no existe.
  test('cannot edit a person of another tenant', async ({ request }) => {
    const response = await request.put(`${USERS}/${BETO}`, {
      headers: auth(await tokenFor(request, ACME_ADMIN)),
      data: { name: 'Colado', roleIds: [] },
    });

    expect(response.status()).toBe(404);
  });

  test('a read-only role cannot edit anyone', async ({ request }) => {
    const response = await request.put(`${USERS}/${ANA}`, {
      headers: auth(await tokenFor(request, ACCOUNTANT)),
      data: { name: 'Colado', roleIds: [] },
    });

    expect(response.status()).toBe(403);
  });
});

test.describe('deactivating a person in a tenant', () => {
  test('cuts access at once, with the session already open', async ({ request }) => {
    const admin = await tokenFor(request, ACME_ADMIN);
    const person = await aFreshPerson(request, admin);
    const theirToken = await tokenFor(request, person);

    const deactivated = await request.put(`${USERS}/${person.userId}/status`, {
      headers: auth(admin),
      data: { active: false },
    });

    expect(deactivated.status()).toBe(200);
    expect((await request.get('/api/v1/auth/me', { headers: auth(theirToken) })).status()).toBe(401);
  });

  test('can be undone', async ({ request }) => {
    const admin = await tokenFor(request, ACME_ADMIN);
    const person = await aFreshPerson(request, admin);

    await request.put(`${USERS}/${person.userId}/status`, { headers: auth(admin), data: { active: false } });
    await request.put(`${USERS}/${person.userId}/status`, { headers: auth(admin), data: { active: true } });

    expect((await request.post(LOGIN, { data: person.credentials })).status()).toBe(200);
  });

  test('refuses to let an administrator deactivate themselves', async ({ request }) => {
    const response = await request.put(`${USERS}/${ANA}/status`, {
      headers: auth(await tokenFor(request, ACME_ADMIN)),
      data: { active: false },
    });

    expect(response.status()).toBe(409);
  });

  test('cannot deactivate a person of another tenant', async ({ request }) => {
    const response = await request.put(`${USERS}/${BETO}/status`, {
      headers: auth(await tokenFor(request, ACME_ADMIN)),
      data: { active: false },
    });

    expect(response.status()).toBe(404);
  });
});

// Ninguna de estas peticiones llega a cambiar nada: todas se rechazan, asi que la
// empresa queda como estaba y no hay nada que restaurar.
test.describe('a company can never be left without an administrator', () => {
  test('the only administrator cannot drop her own role, by either route', async ({ request }) => {
    const token = await tokenFor(request, INITECH_ADMIN);

    const byAssignment = await request.delete(`${ROLES}/assignments`, {
      headers: auth(token),
      data: { userId: DORA, roleId: INITECH_ADMIN_ROLE },
    });
    const byEditing = await request.put(`${USERS}/${DORA}`, {
      headers: auth(token),
      data: { name: 'Dora Paz', roleIds: [] },
    });

    expect(byAssignment.status()).toBe(409);
    expect(byEditing.status()).toBe(409);
  });

  test('the only administrator cannot deactivate herself', async ({ request }) => {
    const response = await request.put(`${USERS}/${DORA}/status`, {
      headers: auth(await tokenFor(request, INITECH_ADMIN)),
      data: { active: false },
    });

    expect(response.status()).toBe(409);
  });

  // Se sigue administrando la empresa despues de las tres negativas.
  test('she still administers afterwards', async ({ request }) => {
    const token = await tokenFor(request, INITECH_ADMIN);
    const { users } = await (await request.get(USERS, { headers: auth(token) })).json();
    const dora = users.find((user: { userId: string }) => user.userId === DORA);

    expect(dora.membershipActive).toBe(true);
    expect(dora.roleIds).toContain(INITECH_ADMIN_ROLE);
  });

  // La pantalla ya escondia su boton de editar; la API lo permitia, y un rol llamado
  // "Consulta" que lo concede todo es peor que no tener la proteccion.
  test('the role that grants everything cannot be renamed', async ({ request }) => {
    const response = await request.put(`${ROLES}/${INITECH_ADMIN_ROLE}`, {
      headers: auth(await tokenFor(request, INITECH_ADMIN)),
      data: { name: 'Consulta basica', permissions: [] },
    });

    expect(response.status()).toBe(409);
  });
});
