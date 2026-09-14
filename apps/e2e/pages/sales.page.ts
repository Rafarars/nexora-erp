import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type Section = 'pedidos' | 'despachos' | 'facturas' | 'disponibilidad' | 'clientes';

// Las pantallas de ventas. Un pedido se busca por su cliente, un despacho por sus notas y una
// factura por su cliente: los codigos los asigna el sistema.
export class SalesPage {
  constructor(private readonly page: Page) {}

  async open(section: Section): Promise<void> {
    // El modulo redirige a su primera seccion: si se elige la seccion antes de que termine esa
    // redireccion, la redireccion llega despues y deja la pantalla en la seccion equivocada.
    await this.page.getByTestId('nav-ventas').click();
    await expect(this.page).toHaveURL(/\/ventas\/[a-z-]+/);
    await this.page.getByTestId(`sales-${section}`).click();
    await expect(this.page).toHaveURL(new RegExp(`/ventas/${section}`));
    await expect(this.page.getByTestId('sales-nav')).toBeVisible();
  }

  orderOf(customer: string): Locator {
    return this.page.locator('[data-testid^="sales-order-row-"]').filter({ hasText: customer });
  }

  dispatchWith(text: string): Locator {
    return this.page.locator('[data-testid^="dispatch-row-"]').filter({ hasText: text });
  }

  invoiceOf(customer: string): Locator {
    return this.page.locator('[data-testid^="invoice-row-"]').filter({ hasText: customer });
  }

  async createOrder(customer: string, line: { item: string; quantity: string; unit: string; price: string }): Promise<void> {
    await this.page.getByTestId('new-sales-order').click();
    await expect(this.page.getByTestId('sales-order-panel')).toBeVisible();
    await this.page.getByTestId('sales-order-customer').selectOption({ label: customer });
    await this.page.getByTestId('sales-order-line-item-0').selectOption({ label: line.item });
    await this.page.getByTestId('sales-order-line-quantity-0').fill(line.quantity);
    await this.page.getByTestId('sales-order-line-unit-0').selectOption({ label: line.unit });
    await this.page.getByTestId('sales-order-line-price-0').fill(line.price);
    await this.page.getByTestId('sales-order-submit').click();
    await expect(this.page.getByTestId('sales-order-panel')).toBeHidden();
  }

  async startDispatching(order: Locator, quantities: string[], notes: string): Promise<void> {
    await this.act(order, 'Despachar');
    await expect(this.page.getByTestId('dispatch-panel')).toBeVisible();

    for (const [index, quantity] of quantities.entries()) {
      await this.page.getByTestId(`dispatch-quantity-${index}`).fill(quantity);
    }

    await this.page.getByTestId('dispatch-notes').fill(notes);
    await this.page.getByTestId('dispatch-submit').click();
  }

  async act(row: Locator, action: string): Promise<void> {
    await row.getByRole('button', { name: 'Opciones' }).click();
    await this.page.getByRole('menuitem', { name: action, exact: true }).click();
  }

  availableOf(sku: string, warehouse: string): Locator {
    return this.page.getByTestId(`availability-available-${sku}-${warehouse}`);
  }

  reservedOf(sku: string, warehouse: string): Locator {
    return this.page.getByTestId(`availability-reserved-${sku}-${warehouse}`);
  }
}
