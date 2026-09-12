import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { AppShell } from '../../pages/app-shell.page.js';

// Da de alta su propia persona desde la interfaz: editar las del seed contaminaria a
// las pruebas que dependen de sus roles.
async function createPerson(page: import('@playwright/test').Page): Promise<string> {
  const email = `ui-${Date.now()}@acme.com`;

  await page.getByTestId('new-user').click();
  await page.getByTestId('user-name').fill('Persona de Prueba');
  await page.getByTestId('user-email').fill(email);
  await page.getByTestId('user-password').fill('a-long-password');
  await page.getByTestId('user-submit').click();
  await expect(page.getByTestId(`user-row-${email}`)).toBeVisible();

  return email;
}

test.describe('Managing people from the list', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).signIn(ACME_ADMIN);
    await new AppShell(page).goToAdministration('usuarios');
  });

  test('edits the name and the roles from the row options', async ({ page }) => {
    const email = await createPerson(page);

    await page.getByTestId(`user-options-${email}`).click();
    await page.getByTestId(`user-edit-${email}`).click();

    await page.getByTestId('edit-name').fill('Nombre Editado');
    await page.getByTestId('edit-role-Consulta').check();
    await page.getByTestId('edit-submit').click();

    const row = page.getByTestId(`user-row-${email}`);
    await expect(row).toContainText('Nombre Editado');
    await expect(page.getByTestId(`user-roles-${email}`)).toHaveText('Consulta');
  });

  // El correo y la contrasena son la llave de la cuenta en todas sus empresas.
  test('shows the email but does not let the administrator change it', async ({ page }) => {
    const email = await createPerson(page);

    await page.getByTestId(`user-options-${email}`).click();
    await page.getByTestId(`user-edit-${email}`).click();

    await expect(page.getByTestId('edit-email')).toBeDisabled();
    await expect(page.getByTestId('user-edit-panel')).not.toContainText('Contraseña actual');
  });

  test('deactivates and reactivates a person', async ({ page }) => {
    const email = await createPerson(page);
    const status = page.getByTestId(`user-status-${email}`);

    await page.getByTestId(`user-options-${email}`).click();
    await page.getByTestId(`user-toggle-status-${email}`).click();
    await expect(status).toHaveText('Inactivo');

    await page.getByTestId(`user-options-${email}`).click();
    await page.getByTestId(`user-toggle-status-${email}`).click();
    await expect(status).toHaveText('Activo');
  });

  test('does not offer to deactivate yourself', async ({ page }) => {
    await page.getByTestId('user-options-ana@acme.com').click();

    await expect(page.getByTestId('user-edit-ana@acme.com')).toBeVisible();
    await expect(page.getByTestId('user-toggle-status-ana@acme.com')).toHaveCount(0);
  });
});

test('a read-only role gets no row options at all', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  await new AppShell(page).goToAdministration('usuarios');

  await expect(page.getByTestId('users-table')).toBeVisible();
  await expect(page.getByTestId('user-options-ana@acme.com')).toHaveCount(0);
});
