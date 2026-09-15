'use server';

import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/modules/catalog/domain/catalog';
import { readablePurchasingError } from '@/modules/purchasing/domain/purchasing-error';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { requireSession } from '@/shared/session/current-session';
import type { FormState } from '@/shared/forms/form-state';

const text = (form: FormData, name: string) => String(form.get(name) ?? '');
const optional = (form: FormData, name: string) => text(form, name).trim() || null;
// Vacia es la tasa del dia; lo que no es un numero viaja como NaN y la API senala el campo.
const rate = (form: FormData) => (text(form, 'exchangeRate').trim() === '' ? null : parseDecimal(text(form, 'exchangeRate')));

async function attempt(fallback: string, work: (token: string) => Promise<void>): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await work(token);
  } catch (error) {
    return { error: readablePurchasingError(error, fallback), done: false };
  }

  // Una entrada cambia la orden, lo que esta en camino y las existencias del inventario.
  revalidatePath('/compras', 'layout');
  revalidatePath('/inventario', 'layout');

  return { error: null, done: true };
}

export async function saveSupplier(_state: FormState, form: FormData): Promise<FormState> {
  const term = text(form, 'paymentTermDays').trim();

  return attempt('No se pudo guardar el proveedor.', (token) =>
    purchasingApi().saveSupplier(token, optional(form, 'id'), {
      name: text(form, 'name'),
      fiscalId: optional(form, 'fiscalId'),
      email: optional(form, 'email'),
      phone: optional(form, 'phone'),
      address: optional(form, 'address'),
      paymentTermDays: term === '' ? null : parseDecimal(term),
    }),
  );
}

export async function changeSupplierStatus(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('No se pudo cambiar el estado.', (token) =>
    purchasingApi().changeSupplierStatus(token, text(form, 'id'), form.get('active') === 'true'),
  );
}

export async function saveOrder(_state: FormState, form: FormData): Promise<FormState> {
  const items = form.getAll('lineItem').map(String);
  const units = form.getAll('lineUnit').map(String);
  const quantities = form.getAll('lineQuantity').map(String);
  const costs = form.getAll('lineCost').map(String);

  return attempt('No se pudo guardar la orden.', (token) =>
    purchasingApi().saveOrder(token, optional(form, 'id'), {
      supplierId: text(form, 'supplierId'),
      warehouseId: text(form, 'warehouseId'),
      date: optional(form, 'date'),
      expectedDate: optional(form, 'expectedDate'),
      notes: optional(form, 'notes'),
      currency: optional(form, 'currency'),
      exchangeRate: rate(form),
      // Una fila sin articulo es una que se agrego y no se lleno: se descarta.
      lines: items
        .map((itemId, index) => ({
          itemId,
          unitId: units[index] ?? '',
          quantity: parseDecimal(quantities[index] ?? ''),
          unitCost: parseDecimal(costs[index] ?? ''),
        }))
        .filter((line) => line.itemId !== ''),
    }),
  );
}

export async function changeOrder(_state: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');

  if (form.get('extra') === 'confirm') {
    return attempt('No se pudo confirmar la orden.', (token) => purchasingApi().confirmOrder(token, id));
  }

  return attempt('No se pudo anular la orden.', (token) => purchasingApi().cancelOrder(token, id));
}

// Crea una entrada si llega la orden; si llega el id de la entrada, edita ese borrador.
export async function saveReceipt(_state: FormState, form: FormData): Promise<FormState> {
  const orderLines = form.getAll('receiptLine').map(String);
  const quantities = form.getAll('receiptQuantity').map(String);
  const input = {
    date: optional(form, 'date'),
    notes: optional(form, 'notes'),
    exchangeRate: rate(form),
    // Una linea en blanco o en cero es una que no llego en esta entrada.
    lines: orderLines
      .map((orderLineId, index) => ({ orderLineId, raw: (quantities[index] ?? '').trim() }))
      .filter(({ raw }) => raw !== '' && raw !== '0')
      .map(({ orderLineId, raw }) => ({ orderLineId, quantity: parseDecimal(raw) })),
  };
  const receiptId = optional(form, 'id');

  return attempt('No se pudo guardar la entrada.', (token) =>
    receiptId ? purchasingApi().updateReceipt(token, receiptId, input) : purchasingApi().createReceipt(token, text(form, 'orderId'), input),
  );
}

export async function changeReceipt(_state: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');

  if (form.get('extra') === 'confirm') {
    return attempt('No se pudo confirmar la entrada.', (token) => purchasingApi().confirmReceipt(token, id));
  }

  return attempt('No se pudo anular la entrada.', (token) => purchasingApi().cancelReceipt(token, id));
}
