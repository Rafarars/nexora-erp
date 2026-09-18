import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type Section = 'articulos' | 'existencias' | 'bajo-minimo' | 'ajustes' | 'kardex';

export interface LineInput {
  item: string;
  direction: 'Entrada' | 'Salida';
  quantity: string;
  unit: string;
  cost?: string;
}

// Las pantallas del inventario. Un ajuste se busca por lo que contiene y no por su
// codigo, que lo asigna el sistema y la prueba no conoce de antemano.
export class InventoryPage {
  constructor(private readonly page: Page) {}

  // El maestro se lista de a 20: para ver un articulo recien creado se busca, como haria una persona.
  async findItem(text: string): Promise<void> {
    await this.page.getByTestId('item-search').fill(text);
    await this.page.getByTestId('item-search-submit').click();
    await expect(this.page).toHaveURL(new RegExp(`q=${encodeURIComponent(text)}`));
  }

  async open(section: Section): Promise<void> {
    // El modulo redirige a su primera seccion: si se elige la seccion antes de que termine esa
    // redireccion, la redireccion llega despues y deja la pantalla en la seccion equivocada.
    await this.page.getByTestId('nav-inventario').click();
    await expect(this.page).toHaveURL(/\/inventario\/[a-z-]+/);
    // Bajo carga, un clic que llega mientras termina la redireccion del modulo se pierde: si la
    // direccion no cambia, se vuelve a pulsar dentro de la misma espera.
    await expect(async () => {
      await this.page.getByTestId(`inventory-${section}`).click();
      await expect(this.page).toHaveURL(new RegExp(`/inventario/${section}`), { timeout: 2_000 });
    }).toPass();
    await expect(this.page.getByTestId('inventory-nav')).toBeVisible();
  }

  adjustmentWith(text: string): Locator {
    return this.page.locator('[data-testid^="adjustment-row-"]').filter({ hasText: text });
  }

  async createAdjustment(lines: LineInput[], notes: string): Promise<void> {
    await this.page.getByTestId('new-adjustment').click();
    await expect(this.page.getByTestId('adjustment-panel')).toBeVisible();
    await this.page.getByTestId('adjustment-notes').fill(notes);

    for (const [index, line] of lines.entries()) {
      if (index > 0) await this.page.getByTestId('adjustment-line-add').click();

      await this.page.getByTestId(`adjustment-line-item-${index}`).selectOption({ label: line.item });
      await this.page.getByTestId(`adjustment-line-direction-${index}`).selectOption({ label: line.direction });
      await this.page.getByTestId(`adjustment-line-quantity-${index}`).fill(line.quantity);
      await this.page.getByTestId(`adjustment-line-unit-${index}`).selectOption({ label: line.unit });
      if (line.cost) await this.page.getByTestId(`adjustment-line-cost-${index}`).fill(line.cost);
    }

    await this.page.getByTestId('adjustment-submit').click();
    await expect(this.page.getByTestId('adjustment-panel')).toBeHidden();
  }

  async act(row: Locator, action: 'Confirmar' | 'Anular' | 'Anular (revierte la existencia)'): Promise<void> {
    await row.getByRole('button', { name: 'Opciones' }).click();
    await this.page.getByRole('menuitem', { name: action, exact: true }).click();
  }

  stockOf(sku: string, warehouse: string): Locator {
    return this.page.getByTestId(`stock-quantity-${sku}-${warehouse}`);
  }
}
