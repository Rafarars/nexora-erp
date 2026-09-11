import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { AppShell } from '../../pages/app-shell.page.js';

test.describe('What a person sees depends on the active tenant', () => {
  // La prueba que resume el hito: una sola persona, dos empresas, dos realidades.
  test('the same person sees different people in each tenant', async ({ page }) => {
    await new LoginPage(page).signIn(ACCOUNTANT);
    const shell = new AppShell(page);

    await shell.goToSettings('usuarios');
    await expect(page.getByTestId('user-row-ana@acme.com')).toBeVisible();
    await expect(page.getByTestId('user-row-beto@globex.com')).toHaveCount(0);

    await shell.switchTo('Globex Servicios');

    await expect(page.getByTestId('user-row-beto@globex.com')).toBeVisible();
    await expect(page.getByTestId('user-row-ana@acme.com')).toHaveCount(0);
  });

  test('someone who belongs to a single tenant gets no switcher', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);

    await expect(new AppShell(page).tenantSwitcher).toHaveCount(0);
    await expect(new AppShell(page).activeTenant).toHaveText('Acme Industrial');
  });

  test('the panel says which tenant you are working in', async ({ page }) => {
    await new LoginPage(page).signIn(ACCOUNTANT);

    await expect(page.getByTestId('panel-tenant')).toHaveText('Acme Industrial');
    await expect(page.getByTestId('panel-tenant-count')).toHaveText('2');
  });
});

test.describe('The interface only offers what the role allows', () => {
  // Carla solo consulta en Acme: ve la tabla pero no la puerta para escribir.
  test('hides the create button from a read-only role', async ({ page }) => {
    await new LoginPage(page).signIn(ACCOUNTANT);
    await new AppShell(page).goToSettings('usuarios');

    await expect(page.getByTestId('users-table')).toBeVisible();
    await expect(page.getByTestId('new-user')).toHaveCount(0);
  });

  test('shows the create button to an administrator', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    await new AppShell(page).goToSettings('usuarios');

    await expect(page.getByTestId('new-user')).toBeVisible();
  });

  // Esconder el boton es cortesia; la puerta la cierra la API. Entrar por la ruta
  // directa tampoco sirve.
  test('refuses the roles screen to someone without the permission', async ({ page }) => {
    await new LoginPage(page).signIn(ACCOUNTANT);

    await page.goto('/configuracion/roles');

    await expect(page.getByTestId('roles-forbidden')).toBeVisible();
  });

  test('gives an administrator the roles screen', async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    await new AppShell(page).goToSettings('roles');

    await expect(page.getByTestId('role-Administrador')).toBeVisible();
  });
});
