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

// El agua tiene 288 y su minimo en Principal es 300: aparece con lo que falta y lo que pedir.
test('shows what is below its minimum, with what to order', async ({ page }) => {
  await new LoginPage(page).signIn(ACME_ADMIN);
  const inventory = new InventoryPage(page);

  await inventory.open('bajo-minimo');

  await expect(page.getByTestId('low-stock-missing-AGUA-500')).toHaveText('12');
  await expect(page.getByTestId('low-stock-suggested-AGUA-500')).toHaveText('480');
});

test('a read-only role sees stock and adjustments but gets no way to change them', async ({ page }) => {
  await new LoginPage(page).signIn(ACCOUNTANT);
  const inventory = new InventoryPage(page);

  await inventory.open('existencias');
  await expect(inventory.stockOf('DETERGENTE-1KG', 'Principal')).toHaveText('50 kg');

  await inventory.open('ajustes');
  await expect(page.getByTestId('adjustment-row-AJU000001')).toBeVisible();
  await expect(page.getByTestId('new-adjustment')).toHaveCount(0);
  await expect(page.getByTestId('adjustment-options-AJU000002')).toHaveCount(0);
});
