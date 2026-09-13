import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type Section = 'articulos' | 'categorias' | 'unidades' | 'impuestos' | 'bodegas';
type Resource = 'item' | 'category' | 'unit' | 'tax' | 'warehouse';

// Las pantallas del catalogo comparten la misma forma: tabla, menu Opciones por fila y
// panel lateral. Las pruebas hablan de "la fila de Bebidas", no de selectores.
export class CatalogPage {
  constructor(private readonly page: Page) {}

  async open(section: Section): Promise<void> {
    await this.page.getByTestId('nav-catalogo').click();
    await this.page.getByTestId(`catalog-${section}`).click();
    await expect(this.page.getByTestId('catalog-nav')).toBeVisible();
  }

  row(resource: Resource, key: string): Locator {
    return this.page.getByTestId(`${resource}-row-${key}`);
  }

  status(resource: Resource, key: string): Locator {
    return this.page.getByTestId(`${resource}-status-${key}`);
  }

  panel(resource: Resource): Locator {
    return this.page.getByTestId(`${resource}-panel`);
  }

  async startCreating(resource: Resource): Promise<void> {
    await this.page.getByTestId(`new-${resource}`).click();
    await expect(this.panel(resource)).toBeVisible();
  }

  async startEditing(resource: Resource, key: string): Promise<void> {
    await this.page.getByTestId(`${resource}-options-${key}`).click();
    await this.page.getByTestId(`${resource}-edit-${key}`).click();
    await expect(this.panel(resource)).toBeVisible();
  }

  async toggleStatus(resource: Resource, key: string): Promise<void> {
    await this.page.getByTestId(`${resource}-options-${key}`).click();
    await this.page.getByTestId(`${resource}-toggle-status-${key}`).click();
  }

  async submit(resource: Resource): Promise<void> {
    await this.page.getByTestId(`${resource}-submit`).click();
  }

  // Guardar bien cierra el panel: esperar a que se cierre es esperar a que se guardo.
  async submitAndClose(resource: Resource): Promise<void> {
    await this.submit(resource);
    await expect(this.panel(resource)).toBeHidden();
  }
}
