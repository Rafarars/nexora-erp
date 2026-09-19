import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type Section = 'ordenes' | 'entradas' | 'en-camino' | 'proveedores';

const FILTER_PREFIX: Record<Section, string> = {
  ordenes: 'order',
  entradas: 'receipt',
  'en-camino': 'incoming',
  proveedores: 'supplier',
};

export interface OrderLineInput {
  item: string;
  quantity: string;
  unit: string;
  cost: string;
}

// Las pantallas de compras. Una orden se busca por su proveedor y una entrada por sus notas:
// los codigos los asigna el sistema y la prueba no los conoce de antemano.
//
// Los listados paginan de 20, asi que una prueba que crea su registro NO puede darlo por visible:
// `open` acepta un texto de busqueda y lo deja filtrado antes de mirar.
export class PurchasingPage {
  constructor(private readonly page: Page) {}

  async open(section: Section, search?: string): Promise<void> {
    // El modulo redirige a su primera seccion: si se elige la seccion antes de que termine esa
    // redireccion, la redireccion llega despues y deja la pantalla en la seccion equivocada.
    await this.page.getByTestId('nav-compras').click();
    await expect(this.page).toHaveURL(/\/compras\/[a-z-]+/);
    // Bajo carga, un clic que llega mientras termina la redireccion del modulo se pierde: si la
    // direccion no cambia, se vuelve a pulsar dentro de la misma espera.
    await expect(async () => {
      await this.page.getByTestId(`purchasing-${section}`).click();
      await expect(this.page).toHaveURL(new RegExp(`/compras/${section}`), { timeout: 2_000 });
    }).toPass();
    await expect(this.page.getByTestId('purchasing-nav')).toBeVisible();

    if (search) await this.search(section, search);
  }

  // Las ordenes se filtran por su proveedor: el buscador de texto mira el codigo y el articulo.
  async filterOrdersBySupplier(supplier: string): Promise<void> {
    await this.page.getByTestId('order-filter-supplier').selectOption({ label: supplier });
    await this.page.getByTestId('order-filter-submit').click();
    await expect(this.page).toHaveURL(/[?&]proveedor=/);
  }

  // Filtra el listado para que el registro de la prueba este en la primera pagina.
  async search(section: Section, text: string): Promise<void> {
    const box = this.page.getByTestId(`${FILTER_PREFIX[section]}-search`);

    await expect(box).toBeVisible();
    await box.fill(text);
    await this.page.getByTestId(`${FILTER_PREFIX[section]}-filter-submit`).click();
    await expect(this.page).toHaveURL(/[?&]q=/);
  }

  orderOf(supplier: string): Locator {
    return this.page.locator('[data-testid^="order-row-"]').filter({ hasText: supplier });
  }

  receiptWith(text: string): Locator {
    return this.page.locator('[data-testid^="receipt-row-"]').filter({ hasText: text });
  }

  async createOrder(supplier: string, lines: OrderLineInput[]): Promise<void> {
    await this.page.getByTestId('new-order').click();
    await expect(this.page.getByTestId('order-panel')).toBeVisible();
    await this.page.getByTestId('order-supplier').selectOption({ label: supplier });

    for (const [index, line] of lines.entries()) {
      if (index > 0) await this.page.getByTestId('order-line-add').click();

      await this.page.getByTestId(`order-line-item-${index}`).selectOption({ label: line.item });
      await this.page.getByTestId(`order-line-quantity-${index}`).fill(line.quantity);
      await this.page.getByTestId(`order-line-unit-${index}`).selectOption({ label: line.unit });
      await this.page.getByTestId(`order-line-cost-${index}`).fill(line.cost);
    }

    await this.page.getByTestId('order-submit').click();
    await expect(this.page.getByTestId('order-panel')).toBeHidden();
  }

  // Abre el panel de recepcion de una orden y deja escrito cuanto llego de cada linea.
  async startReceiving(order: Locator, quantities: string[], notes: string): Promise<void> {
    await this.act(order, 'Recibir mercancía');
    await expect(this.page.getByTestId('receive-panel')).toBeVisible();

    for (const [index, quantity] of quantities.entries()) {
      await this.page.getByTestId(`receipt-quantity-${index}`).fill(quantity);
    }

    await this.page.getByTestId('receipt-notes').fill(notes);
    await this.page.getByTestId('receive-submit').click();
  }

  async act(row: Locator, action: 'Confirmar' | 'Anular' | 'Anular (revierte la existencia)' | 'Recibir mercancía' | 'Editar'): Promise<void> {
    await row.getByRole('button', { name: 'Opciones' }).click();
    await this.page.getByRole('menuitem', { name: action, exact: true }).click();
  }

  incomingOf(sku: string, warehouse: string): Locator {
    return this.page.getByTestId(`incoming-quantity-${sku}-${warehouse}`);
  }
}
