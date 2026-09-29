import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type Section = 'pagos' | 'facturas' | 'antiguedad' | 'estado-de-cuenta' | 'notas-de-credito';

const FILTER_PREFIX: Partial<Record<Section, string>> = {
  pagos: 'payment',
  facturas: 'payable',
  antiguedad: 'aging',
  'notas-de-credito': 'credit-note',
};

// Las pantallas de cuentas por pagar. Un pago se busca por su proveedor: los codigos los asigna
// el sistema.
//
// Los listados paginan de 20, asi que una prueba que busca su documento NO puede darlo por
// visible: `open` acepta un texto de busqueda y lo deja filtrado antes de mirar.
export class PayablesPage {
  constructor(private readonly page: Page) {}

  async open(section: Section, search?: string): Promise<void> {
    // Desde fuera, se espera la redireccion del modulo para no cambiar de seccion a destiempo;
    // una vez dentro, ya no redirige y pulsar la raiz solo recargaria la primera pestaña.
    if (!this.page.url().includes('/cuentas-por-pagar/')) {
      await this.page.getByTestId('nav-cuentas-por-pagar').click();
      await expect(this.page).toHaveURL(/\/cuentas-por-pagar\/[a-z-]+/);
    }
    // Bajo carga, un clic que llega mientras termina la redireccion del modulo se pierde: si la
    // direccion no cambia, se vuelve a pulsar dentro de la misma espera.
    await expect(async () => {
      await this.page.getByTestId(`payables-${section}`).click();
      await expect(this.page).toHaveURL(new RegExp(`/cuentas-por-pagar/${section}`), { timeout: 2_000 });
    }).toPass();
    await expect(this.page.getByTestId('payables-nav')).toBeVisible();

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

  paymentOf(supplier: string): Locator {
    return this.page.locator('[data-testid^="payment-row-"]').filter({ hasText: supplier });
  }

  creditNoteOf(supplier: string): Locator {
    return this.page.locator('[data-testid^="credit-note-row-"]').filter({ hasText: supplier });
  }

  async startPayment(
    supplier: string,
    allocations: { invoice: string; amount: string }[],
    reference: string,
    options?: { method?: string; creditSourceCode?: string; currency?: string },
  ): Promise<void> {
    await this.page.getByTestId('new-payment').click();
    await expect(this.page.getByTestId('payment-panel')).toBeVisible();
    await this.page.getByTestId('payment-supplier').selectOption({ label: supplier });

    if (options?.method) {
      await this.page.getByTestId('payment-method').selectOption(options.method);
    }

    if (options?.creditSourceCode) {
      const select = this.page.getByTestId('payment-credit-source');
      await expect(select).toBeVisible();
      const optionLocator = select.locator('option', { hasText: options.creditSourceCode });
      const val = await optionLocator.getAttribute('value');
      if (val) {
        await select.selectOption(val);
      }
    }

    if (options?.currency) {
      await this.page.getByTestId('payment-currency').selectOption(options.currency);
    }

    if (reference) {
      await this.page.getByTestId('payment-reference').fill(reference);
    }

    for (const { invoice, amount } of allocations) {
      await this.page.getByTestId(`payment-allocation-${invoice}`).fill(amount);
    }

    await this.page.getByTestId('payment-submit').click();
  }

  async act(row: Locator, action: string): Promise<void> {
    await row.getByRole('button', { name: 'Opciones' }).click();
    await this.page.getByRole('menuitem', { name: action, exact: true }).click();
  }

  async showStatementOf(supplier: string): Promise<void> {
    await this.page.getByTestId('statement-supplier').selectOption({ label: supplier });
    await this.page.getByTestId('statement-submit').click();
    await expect(this.page.getByTestId('statement-table')).toBeVisible();
  }
}
