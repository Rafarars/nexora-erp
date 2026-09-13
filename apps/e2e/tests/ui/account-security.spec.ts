import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { AppShell } from '../../pages/app-shell.page.js';

// El proyecto `ui` apunta al frontend: para preparar datos se llama a la API por su URL.
const API = process.env.API_URL ?? 'http://localhost:3001';

async function aFreshAccount(request: APIRequestContext) {
  const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: ACME_ADMIN })).json();
  const account = {
    email: `ui-cuenta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@acme.com`,
    password: 'a-long-password',
  };

  await request.post(`${API}/api/v1/users`, {
    headers: { authorization: `Bearer ${token}` },
    data: { ...account, name: 'Cuenta de Prueba' },
  });

  const { users } = await (
    await request.get(`${API}/api/v1/users`, { headers: { authorization: `Bearer ${token}` } })
  ).json();

  return {
    ...account,
    adminToken: token as string,
    userId: users.find((user: { email: string }) => user.email === account.email).userId as string,
  };
}

test.describe('Forms that handle credentials', () => {
  // Sin estos atributos Chrome tomaba el alta de otra persona por un login y la
  // rellenaba con las credenciales guardadas de quien administra.
  test('the form to add a person does not offer saved credentials', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    await new AppShell(page).goToAdministration('usuarios');
    await page.getByTestId('new-user').click();

    await expect(page.getByTestId('user-email')).toHaveAttribute('autocomplete', 'off');
    await expect(page.getByTestId('user-password')).toHaveAttribute('autocomplete', 'new-password');
  });

  test('the password form tells the browser which password is which', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    await new AppShell(page).goToProfile();

    await expect(page.getByTestId('password-current')).toHaveAttribute('autocomplete', 'current-password');
    await expect(page.getByTestId('password-next')).toHaveAttribute('autocomplete', 'new-password');
    await expect(page.getByTestId('password-confirmation')).toHaveAttribute('autocomplete', 'new-password');
  });
});

test.describe('Your own email', () => {
  test('changes only after confirming the current password', async ({ page, request }) => {
    const account = await aFreshAccount(request);
    const newEmail = `ui-nuevo-${Date.now()}@acme.com`;

    await new LoginPage(page).signIn(account);
    await new AppShell(page).goToProfile();

    await page.getByTestId('email-new').fill(newEmail);
    await page.getByTestId('email-password').fill('not-the-password');
    await page.getByTestId('email-submit').click();
    await expect(page.getByTestId('email-error')).toHaveText('La contraseña actual no es correcta.');

    await page.getByTestId('email-new').fill(newEmail);
    await page.getByTestId('email-password').fill(account.password);
    await page.getByTestId('email-submit').click();

    await expect(page.getByTestId('email-saved')).toBeVisible();
    await expect(page.getByTestId('profile-email')).toHaveValue(newEmail);
  });
});

test('a person whose access was revoked is told so instead of a wrong password', async ({
  page,
  request,
}) => {
  const account = await aFreshAccount(request);

  await request.put(`${API}/api/v1/users/${account.userId}/status`, {
    headers: { authorization: `Bearer ${account.adminToken}` },
    data: { active: false },
  });

  const login = new LoginPage(page);
  await login.open();
  await login.fill(account);

  await expect(login.error).toContainText('no tiene acceso activo');
});
