import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export const PASSWORD = 'Nexora-2026!';

// Las tres personas del seed, con lo que cada una puede hacer. Las pruebas hablan de
// "la administradora de Acme", no de un correo suelto.
export const ACME_ADMIN = { email: 'ana@acme.com', password: PASSWORD };
export const GLOBEX_ADMIN = { email: 'beto@globex.com', password: PASSWORD };
export const ACCOUNTANT = { email: 'contador@externo.com', password: PASSWORD };
// Administrador en todas las empresas por membresia, sin ningun atajo en el codigo.
export const SUPERUSER = { email: 'admin@nexora.com', password: PASSWORD };

export class LoginPage {
  readonly form: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.form = page.getByTestId('login-form');
    this.email = page.getByTestId('login-email');
    this.password = page.getByTestId('login-password');
    this.submit = page.getByTestId('login-submit');
    this.error = page.getByTestId('login-error');
  }

  async open(): Promise<void> {
    await this.page.goto('/login');
  }

  async fill(credentials: { email: string; password: string }): Promise<void> {
    await this.email.fill(credentials.email);
    await this.password.fill(credentials.password);
    await this.submit.click();
  }

  // Entrar y esperar a estar dentro: sin esto, la prueba sigue con la pantalla a medias.
  async signIn(credentials: { email: string; password: string }): Promise<void> {
    await this.open();
    await this.fill(credentials);
    await expect(this.page.getByTestId('current-user')).toBeVisible();
  }
}
