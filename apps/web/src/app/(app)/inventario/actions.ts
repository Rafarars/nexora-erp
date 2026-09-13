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

  // Confirmar o anular cambia existencias y kardex, no solo la lista de ajustes.
  revalidatePath('/inventario', 'layout');

  return { error: null, done: true };
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
