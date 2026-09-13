import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type Section = 'existencias' | 'ajustes' | 'kardex';

export interface LineInput {
  item: string;
  direction: 'Entrada' | 'Salida';
  quantity: string;
  unit: string;
  cost?: string;
}

// Las tres pantallas del inventario. Un ajuste se busca por lo que contiene y no por su
// codigo, que lo asigna el sistema y la prueba no conoce de antemano.
export class InventoryPage {
  constructor(private readonly page: Page) {}

  async open(section: Section): Promise<void> {
    await this.page.getByTestId('nav-inventario').click();
    await this.page.getByTestId(`inventory-${section}`).click();
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
