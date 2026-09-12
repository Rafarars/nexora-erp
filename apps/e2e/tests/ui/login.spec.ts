import { expect, test } from '@playwright/test';
import {
  ACCOUNTANT,
  ACME_ADMIN,
  GLOBEX_ADMIN,
  LoginPage,
  PASSWORD,
} from '../../pages/login.page.js';
import { AppShell } from '../../pages/app-shell.page.js';

test.describe('Signing in', () => {
  test('lets a person into the system', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);

    await expect(new AppShell(page).currentUser).toHaveText('Ana Rivas');
    await expect(page.getByTestId('panel-tenant')).toHaveText('Acme Industrial');
  });

  test('rejects a wrong password without saying which field failed', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();

    await login.fill({ email: ACME_ADMIN.email, password: 'wrong-password' });

    await expect(login.error).toHaveText('Correo o contraseña incorrectos.');
  });

  // El mismo mensaje para un correo que no existe: la pantalla no delata que cuentas
  // estan registradas.
  test('answers the same for an email that does not exist', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();

    // Distinto en cada corrida: uno fijo acumularia fallos y acabaria bloqueado.
    await login.fill({ email: `nadie-${Date.now()}@acme.com`, password: PASSWORD });

    await expect(login.error).toHaveText('Correo o contraseña incorrectos.');
  });

  test('sends anyone without a session back to the login', async ({ page }) => {
    await page.goto('/administracion/usuarios');

    await expect(page).toHaveURL(/\/login$/);
    await expect(new LoginPage(page).form).toBeVisible();
  });

  // El token vive en una cookie httpOnly puesta por el servidor: ningun script de la
  // pagina puede leerlo, asi que uno inyectado no se lo lleva.
  test('keeps the session token out of reach of any script', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);

    expect(await page.evaluate(() => document.cookie)).not.toContain('nexora_session');

    const cookie = (await page.context().cookies()).find((c) => c.name === 'nexora_session');
    expect(cookie?.httpOnly).toBe(true);
  });

  test('logs out and forgets the session', async ({ page }) => {
    await new LoginPage(page).signIn(ACCOUNTANT);

    await new AppShell(page).logout();

    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/administracion/usuarios');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Your own account', () => {
  test('changes your name and shows it right away', async ({ page }) => {
    await new LoginPage(page).signIn(GLOBEX_ADMIN);
    await new AppShell(page).goToProfile();

    await page.getByTestId('profile-name').fill('Beto Lugo Mendez');
    await page.getByTestId('profile-submit').click();

    await expect(page.getByTestId('profile-saved')).toBeVisible();
    await expect(new AppShell(page).currentUser).toHaveText('Beto Lugo Mendez');
  });

  // El correo identifica la cuenta en todas las empresas: no es una preferencia.
  test('does not let you change your own email', async ({ page }) => {
    await new LoginPage(page).signIn(GLOBEX_ADMIN);
    await new AppShell(page).goToProfile();

    await expect(page.getByTestId('profile-email')).toBeDisabled();
  });

  test('refuses to change the password without the current one', async ({ page }) => {
    await new LoginPage(page).signIn(GLOBEX_ADMIN);
    await new AppShell(page).goToProfile();

    await page.getByTestId('password-current').fill('not-the-current-one');
    await page.getByTestId('password-next').fill('a-brand-new-password');
    await page.getByTestId('password-confirmation').fill('a-brand-new-password');
    await page.getByTestId('password-submit').click();

    await expect(page.getByTestId('password-error')).toBeVisible();
  });

  test('refuses a confirmation that does not match', async ({ page }) => {
    await new LoginPage(page).signIn(GLOBEX_ADMIN);
    await new AppShell(page).goToProfile();

    await page.getByTestId('password-current').fill(PASSWORD);
    await page.getByTestId('password-next').fill('a-brand-new-password');
    await page.getByTestId('password-confirmation').fill('another-password');
    await page.getByTestId('password-submit').click();

    await expect(page.getByTestId('password-error')).toContainText('no coinciden');
  });
});
