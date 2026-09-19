import { expect, test } from '@playwright/test';
import { ACCOUNTANT, ACME_ADMIN, LoginPage } from '../../pages/login.page.js';
import { InventoryPage } from '../../pages/inventory.page.js';
import { aFreshItem, tokenFor } from '../../support/inventory-fixtures.js';

const API = process.env.API_URL ?? 'http://localhost:3001';

test.describe('The inventory, from the screen', () => {
  // El recorrido del hito: un ajuste en cajas con costo, confirmado, visto en existencias y
  // en el kardex, y anulado con su contrapartida. Con un articulo propio, para que ninguna
  // prueba en paralelo le mueva la existencia.
  test('adjusts, reads the stock and the kardex, and cancels with a reversal', async ({ page, request }) => {
    const item = await aFreshItem(request, await tokenFor(request, ACME_ADMIN.email, API), API);
    const label = `${item.sku} — ${item.name}`;
    const inventory = new InventoryPage(page);

    await new LoginPage(page).signIn(ACME_ADMIN);
    await inventory.open('ajustes');
    await inventory.createAdjustment([{ item: label, direction: 'Entrada', quantity: '2', unit: 'cja', cost: '12' }], `Compra inicial ${item.sku}`);

    const row = inventory.adjustmentWith(item.sku);
    await expect(row.getByTestId(/adjustment-status-/)).toHaveText('Borrador');
    await expect(row.getByTestId(/adjustment-lines-/)).toContainText('+2 cja (48 un)');

    await inventory.act(row, 'Confirmar');
    await expect(row.getByTestId(/adjustment-status-/)).toHaveText('Confirmado');

    await inventory.open('existencias');
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('48 un');

    await inventory.open('kardex');
    await page.getByTestId('kardex-item').selectOption({ label });
    await page.getByTestId('kardex-submit').click();
    await expect(page.getByTestId('kardex-balance-Principal-1')).toHaveText('48 un');

    await inventory.open('ajustes');
    await inventory.act(inventory.adjustmentWith(item.sku), 'Anular (revierte la existencia)');
    await expect(inventory.adjustmentWith(item.sku).getByTestId(/adjustment-status-/)).toHaveText('Anulado');

    await inventory.open('kardex');
    await page.getByTestId('kardex-item').selectOption({ label });
    await page.getByTestId('kardex-submit').click();
    await expect(page.getByTestId('kardex-row-Principal-2')).toContainText('(anulación)');
    await expect(page.getByTestId('kardex-balance-Principal-2')).toHaveText('0 un');
  });

  // Lo que la revision de Ajustes construyo: el motivo, quien lo hizo, los filtros y la
  // revaluacion, que cambia el costo sin tocar la cantidad.
  test('records the reason and who did it, filters the list, and revalues without moving quantity', async ({ page, request }) => {
    const item = await aFreshItem(request, await tokenFor(request, ACME_ADMIN.email, API), API);
    const label = `${item.sku} — ${item.name}`;
    const inventory = new InventoryPage(page);

    await new LoginPage(page).signIn(ACME_ADMIN);
    await inventory.open('ajustes');
    await inventory.createAdjustment(
      [{ item: label, direction: 'Entrada', quantity: '20', unit: 'un', cost: '2' }],
      `Conteo ${item.sku}`,
      'Conteo físico',
    );

    const row = inventory.adjustmentWith(item.sku);
    await expect(row.getByTestId(/adjustment-type-/)).toHaveText('Conteo físico');
    await expect(row.getByTestId(/adjustment-author-/)).toContainText('Registró');

    await inventory.act(row, 'Confirmar');
    await expect(inventory.adjustmentWith(item.sku).getByTestId(/adjustment-author-/)).toContainText('Confirmó');

    // El filtro por motivo deja fuera lo que no lo cumple.
    await page.getByTestId('adjustment-filter-type').selectOption({ label: 'Merma' });
    await page.getByTestId('adjustment-search-submit').click();
    await expect(inventory.adjustmentWith(item.sku)).toHaveCount(0);

    await page.getByTestId('adjustment-filter-type').selectOption({ label: 'Conteo físico' });
    await page.getByTestId('adjustment-search-submit').click();
    await expect(inventory.adjustmentWith(item.sku)).toHaveCount(1);

    await inventory.open('ajustes');
    await inventory.createRevaluation(label, '3', `Revaluar ${item.sku}`);
    await inventory.act(page.getByTestId(/adjustment-row-/).filter({ hasText: 'Revaluación' }).first(), 'Confirmar');

    // La cantidad no cambia; el promedio, si.
    await inventory.open('existencias');
    await expect(inventory.stockOf(item.sku, 'Principal')).toHaveText('20 un');

    await inventory.open('kardex');
    await page.getByTestId('kardex-item').selectOption({ label });
    await page.getByTestId('kardex-submit').click();
    await expect(page.getByTestId('kardex-balance-Principal-3')).toHaveText('20 un');
    await expect(page.getByTestId('kardex-row-Principal-3')).toContainText('3,00');
  });

  test('explains in Spanish that there is not enough stock and keeps the draft', async ({ page, request }) => {
    const item = await aFreshItem(request, await tokenFor(request, ACME_ADMIN.email, API), API);
    const inventory = new InventoryPage(page);

    await new LoginPage(page).signIn(ACME_ADMIN);
    await inventory.open('ajustes');
    await inventory.createAdjustment(
      [{ item: `${item.sku} — ${item.name}`, direction: 'Salida', quantity: '5', unit: 'un' }],
      `Merma ${item.sku}`,
    );

    const row = inventory.adjustmentWith(item.sku);
    await inventory.act(row, 'Confirmar');

    await expect(page.getByTestId('adjustment-action-error')).toHaveText('No hay existencia suficiente para esta salida.');
    await expect(row.getByTestId(/adjustment-status-/)).toHaveText('Borrador');
  });
});

// El detergente proyecta 60 —50 que hay, 10 vendidos, 20 en camino— contra un minimo de 80.
// El agua no aparece aunque tenga 288 contra un minimo de 300, porque ya viene en camino.
test('shows what is below its minimum, with what to order', async ({ page }) => {
  await new LoginPage(page).signIn(ACME_ADMIN);
  const inventory = new InventoryPage(page);

  await inventory.open('bajo-minimo');

  await expect(page.getByTestId('low-stock-missing-DETERGENTE-1KG')).toHaveText('20');
  await expect(page.getByTestId('low-stock-suggested-DETERGENTE-1KG')).toHaveText('20');
  // La pantalla explica de donde sale el numero: lo que hay, lo vendido, lo que viene y el total.
  await expect(page.getByTestId('low-stock-projected-DETERGENTE-1KG')).toHaveText('60');
  await expect(page.getByTestId('low-stock-incoming-DETERGENTE-1KG')).toHaveText('20');
  await expect(page.getByTestId('low-stock-row-AGUA-500')).toHaveCount(0);
});

test('a read-only role sees stock and adjustments but gets no way to change them', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  const inventory = new InventoryPage(page);

  await inventory.open('existencias');
  await expect(inventory.stockOf('DETERGENTE-1KG', 'Principal')).toHaveText('50 kg');

  // El listado pagina, asi que los ajustes de la semilla se buscan. Filtrar tambien es leer:
  // un rol de solo lectura puede hacerlo.
  await inventory.open('ajustes');
  await page.getByTestId('adjustment-search').fill('AJU00000');
  await page.getByTestId('adjustment-search-submit').click();
  await expect(page.getByTestId('adjustment-row-AJU000001')).toBeVisible();
  await expect(page.getByTestId('new-adjustment')).toHaveCount(0);
  await expect(page.getByTestId('adjustment-options-AJU000002')).toHaveCount(0);
});
