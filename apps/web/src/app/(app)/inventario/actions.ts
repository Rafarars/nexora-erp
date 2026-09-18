'use server';

import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/modules/catalog/domain/catalog';
import { readableInventoryError } from '@/modules/inventory/domain/inventory-error';
import { inventoryApi } from '@/shared/session/inventory-api';
import { requireSession } from '@/shared/session/current-session';
import type { FormState } from '@/shared/forms/form-state';

async function attempt(fallback: string, work: (token: string) => Promise<void>): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await work(token);
  } catch (error) {
    return { error: readableInventoryError(error, fallback), done: false };
  }

  // Confirmar o anular cambia existencias y kardex, no solo la lista de ajustes; un articulo
  // aparece en todas las pantallas del modulo.
  revalidatePath('/inventario', 'layout');

  return { error: null, done: true };
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '');
const optional = (form: FormData, name: string) => text(form, name).trim() || null;

export async function saveItem(_state: FormState, form: FormData): Promise<FormState> {
  const unitIds = form.getAll('unitId').map(String);
  const factors = form.getAll('conversionFactor').map(String);
  const base = text(form, 'baseUnit');
  const ruleWarehouses = form.getAll('ruleWarehouse').map(String);
  const ruleMinimums = form.getAll('ruleMin').map(String);
  const ruleMaximums = form.getAll('ruleMax').map(String);
  const ruleQuantities = form.getAll('ruleQuantity').map(String);

  return attempt('No se pudo guardar el artículo.', (token) =>
    inventoryApi().saveItem(token, text(form, 'id') || null, {
      sku: text(form, 'sku'),
      name: text(form, 'name'),
      description: optional(form, 'description'),
      type: text(form, 'type'),
      categoryId: optional(form, 'categoryId'),
      barcode: optional(form, 'barcode'),
      isPurchasable: form.get('isPurchasable') !== null,
      isSellable: form.get('isSellable') !== null,
      salesTaxId: optional(form, 'salesTaxId'),
      purchaseTaxId: optional(form, 'purchaseTaxId'),
      // Las filas sin unidad elegida se descartan: son las que la persona anadio y no
      // lleno. La base vale 1 siempre; el campo ni se muestra.
      units: unitIds
        .map((unitId, index) => ({
          unitId,
          isBase: unitId === base,
          conversionFactor: unitId === base ? 1 : parseDecimal(factors[index] ?? ''),
        }))
        .filter((unit) => unit.unitId !== ''),
      // Igual que las unidades: la fila sin bodega elegida no cuenta.
      reorderRules: ruleWarehouses
        .map((warehouseId, index) => ({
          warehouseId,
          minQuantity: parseDecimal(ruleMinimums[index] ?? ''),
          maxQuantity: (ruleMaximums[index] ?? '').trim() === '' ? null : parseDecimal(ruleMaximums[index] ?? ''),
          reorderQuantity: (ruleQuantities[index] ?? '').trim() === '' ? 0 : parseDecimal(ruleQuantities[index] ?? ''),
        }))
        .filter((rule) => rule.warehouseId !== ''),
    }),
  );
}

export async function changeItemStatus(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('No se pudo cambiar el estado.', (token) =>
    inventoryApi().changeItemStatus(token, text(form, 'id'), form.get('active') === 'true'),
  );
}

export async function saveAdjustment(_state: FormState, form: FormData): Promise<FormState> {
  const items = form.getAll('lineItem').map(String);
  const units = form.getAll('lineUnit').map(String);
  const directions = form.getAll('lineDirection').map(String);
  const quantities = form.getAll('lineQuantity').map(String);
  const costs = form.getAll('lineCost').map(String);
  const id = String(form.get('id') ?? '') || null;

  return attempt('No se pudo guardar el ajuste.', (token) =>
    inventoryApi().saveAdjustment(token, id, {
      warehouseId: String(form.get('warehouseId') ?? ''),
      date: String(form.get('date') ?? '') || null,
      notes: String(form.get('notes') ?? '').trim() || null,
      // Una fila sin articulo es una que se agrego y no se lleno: se descarta.
      lines: items
        .map((itemId, index) => ({
          itemId,
          unitId: units[index] ?? '',
          direction: directions[index] ?? '',
          quantity: parseDecimal(quantities[index] ?? ''),
          unitCost: directions[index] === 'in' && (costs[index] ?? '').trim() !== '' ? parseDecimal(costs[index]) : null,
        }))
        .filter((line) => line.itemId !== ''),
    }),
  );
}

export async function changeAdjustment(_state: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('id') ?? '');

  if (form.get('extra') === 'confirm') {
    return attempt('No se pudo confirmar el ajuste.', (token) => inventoryApi().confirmAdjustment(token, id));
  }

  return attempt('No se pudo anular el ajuste.', (token) => inventoryApi().cancelAdjustment(token, id));
}
