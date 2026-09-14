import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type Section = 'articulos' | 'categorias' | 'unidades' | 'impuestos' | 'bodegas';
type Resource = 'item' | 'category' | 'unit' | 'tax' | 'warehouse';

// Las pantallas del catalogo comparten la misma forma: tabla, menu Opciones por fila y
// panel lateral. Las pruebas hablan de "la fila de Bebidas", no de selectores.
export class CatalogPage {
  constructor(private readonly page: Page) {}

  async open(section: Section): Promise<void> {
    // El modulo redirige a su primera seccion: si se elige la seccion antes de que termine esa
    // redireccion, la redireccion llega despues y deja la pantalla en la seccion equivocada.
    await this.page.getByTestId('nav-catalogo').click();
    await expect(this.page).toHaveURL(/\/catalogo\/[a-z-]+/);
    // Bajo carga, un clic que llega mientras termina la redireccion del modulo se pierde: si la
    // direccion no cambia, se vuelve a pulsar dentro de la misma espera.
    await expect(async () => {
      await this.page.getByTestId(`catalog-${section}`).click();
      await expect(this.page).toHaveURL(new RegExp(`/catalogo/${section}`), { timeout: 2_000 });
    }).toPass();
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
