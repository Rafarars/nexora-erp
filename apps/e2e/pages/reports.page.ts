import { expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

type Section = 'antiguedad' | 'estado-de-cuenta' | 'ventas-por-cliente' | 'valuacion-inventario';

export class ReportsPage {
  constructor(private readonly page: Page) {}

  async open(section: Section): Promise<void> {
    await this.page.getByTestId('nav-reportes').click();
    await expect(this.page).toHaveURL(/\/reportes\/[a-z-]+/);
    // Bajo carga, un clic que llega mientras termina la redireccion del modulo se pierde: si la
    // direccion no cambia, se vuelve a pulsar dentro de la misma espera.
    await expect(async () => {
      await this.page.getByTestId(`reports-${section}`).click();
      await expect(this.page).toHaveURL(new RegExp(`/reportes/${section}`), { timeout: 2_000 });
    }).toPass();
    await expect(this.page.getByTestId('reports-nav')).toBeVisible();
  }

  // Descarga de verdad, como el navegador de una persona: el archivo pasa por el servidor de Next.
  async download(testId: string): Promise<{ download: Download; content: Buffer }> {
    const [download] = await Promise.all([this.page.waitForEvent('download'), this.page.getByTestId(testId).click()]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];

    for await (const chunk of stream) chunks.push(chunk as Buffer);

    return { download, content: Buffer.concat(chunks) };
  }
}
