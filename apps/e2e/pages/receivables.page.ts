import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type Section = 'cobros' | 'facturas' | 'antiguedad' | 'estado-de-cuenta';

// El estado de cuenta no es un listado: se elige el cliente dentro, no se filtra.
const FILTER_PREFIX: Partial<Record<Section, string>> = {
  cobros: 'payment',
  facturas: 'receivable',
  antiguedad: 'aging',
};

// Las pantallas de cuentas por cobrar. Un cobro se busca por su cliente: los codigos los asigna
// el sistema.
//
// Los listados paginan de 20, asi que una prueba que busca su documento NO puede darlo por
// visible: `open` acepta un texto de busqueda y lo deja filtrado antes de mirar.
export class ReceivablesPage {
  constructor(private readonly page: Page) {}

  async open(section: Section, search?: string): Promise<void> {
    // Como en ventas: se espera la redireccion del modulo antes de elegir la seccion.
    await this.page.getByTestId('nav-cuentas-por-cobrar').click();
    await expect(this.page).toHaveURL(/\/cuentas-por-cobrar\/[a-z-]+/);
    // Bajo carga, un clic que llega mientras termina la redireccion del modulo se pierde: si la
    // direccion no cambia, se vuelve a pulsar dentro de la misma espera.
    await expect(async () => {
      await this.page.getByTestId(`receivables-${section}`).click();
      await expect(this.page).toHaveURL(new RegExp(`/cuentas-por-cobrar/${section}`), { timeout: 2_000 });
    }).toPass();
    await expect(this.page.getByTestId('receivables-nav')).toBeVisible();

    if (search) await this.search(section, search);
  }

  // Filtra el listado para que el documento que la prueba busca este en la primera pagina.
  async search(section: Section, text: string): Promise<void> {
    const prefijo = FILTER_PREFIX[section];

    if (!prefijo) throw new Error(`La seccion ${section} no tiene buscador`);

    const box = this.page.getByTestId(`${prefijo}-search`);

    await expect(box).toBeVisible();
    await box.fill(text);
    await this.page.getByTestId(`${prefijo}-filter-submit`).click();
    await expect(this.page).toHaveURL(/[?&]q=/);
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
