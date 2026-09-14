import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type Section = 'cobros' | 'facturas' | 'antiguedad' | 'estado-de-cuenta';

// Las pantallas de cuentas por cobrar. Un cobro se busca por su cliente: los codigos los asigna
// el sistema.
export class ReceivablesPage {
  constructor(private readonly page: Page) {}

  async open(section: Section): Promise<void> {
    // Como en ventas: se espera la redireccion del modulo antes de elegir la seccion.
    await this.page.getByTestId('nav-cuentas-por-cobrar').click();
    await expect(this.page).toHaveURL(/\/cuentas-por-cobrar\/[a-z-]+/);
    await this.page.getByTestId(`receivables-${section}`).click();
    await expect(this.page).toHaveURL(new RegExp(`/cuentas-por-cobrar/${section}`));
    await expect(this.page.getByTestId('receivables-nav')).toBeVisible();
  }

  paymentOf(customer: string): Locator {
    return this.page.locator('[data-testid^="payment-row-"]').filter({ hasText: customer });
  }

  async startPayment(customer: string, allocations: { invoice: string; amount: string }[], reference: string): Promise<void> {
    await this.page.getByTestId('new-payment').click();
    await expect(this.page.getByTestId('payment-panel')).toBeVisible();
    await this.page.getByTestId('payment-customer').selectOption({ label: customer });
    await this.page.getByTestId('payment-reference').fill(reference);

    for (const { invoice, amount } of allocations) {
      await this.page.getByTestId(`payment-allocation-${invoice}`).fill(amount);
    }

    await this.page.getByTestId('payment-submit').click();
  }

  async act(row: Locator, action: string): Promise<void> {
    await row.getByRole('button', { name: 'Opciones' }).click();
    await this.page.getByRole('menuitem', { name: action, exact: true }).click();
  }

  async showStatementOf(customer: string): Promise<void> {
    await this.page.getByTestId('statement-customer').selectOption({ label: customer });
    await this.page.getByTestId('statement-submit').click();
    await expect(this.page.getByTestId('statement-table')).toBeVisible();
  }
}
