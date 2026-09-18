'use server';

import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/modules/catalog/domain/catalog';
import { readableSalesError } from '@/modules/sales/domain/sales-error';
import { salesApi } from '@/shared/session/sales-api';
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
    return { error: readableSalesError(error, fallback), done: false };
  }

  // Un pedido cambia la disponibilidad; un despacho, tambien las existencias del inventario.
  revalidatePath('/ventas', 'layout');
  revalidatePath('/inventario', 'layout');

  return { error: null, done: true };
}

export async function saveCustomer(_state: FormState, form: FormData): Promise<FormState> {
  const term = text(form, 'paymentTermDays').trim();
  // Vacio es sin limite; un cero es no fiarle nada.
  const limit = text(form, 'creditLimit').trim();

  return attempt('No se pudo guardar el cliente.', (token) =>
    salesApi().saveCustomer(token, optional(form, 'id'), {
      name: text(form, 'name'),
      fiscalId: optional(form, 'fiscalId'),
      email: optional(form, 'email'),
      phone: optional(form, 'phone'),
      address: optional(form, 'address'),
      paymentTermDays: term === '' ? null : parseDecimal(term),
      creditLimit: limit === '' ? null : parseDecimal(limit),
      priceListId: optional(form, 'priceListId'),
    }),
  );
}

export async function changeCustomerStatus(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('No se pudo cambiar el estado.', (token) => salesApi().changeCustomerStatus(token, text(form, 'id'), form.get('active') === 'true'));
}

export async function saveOrder(_state: FormState, form: FormData): Promise<FormState> {
  const items = form.getAll('lineItem').map(String);
  const units = form.getAll('lineUnit').map(String);
  const quantities = form.getAll('lineQuantity').map(String);
  const prices = form.getAll('linePrice').map(String);

  return attempt('No se pudo guardar el pedido.', (token) =>
    salesApi().saveOrder(token, optional(form, 'id'), {
      customerId: text(form, 'customerId'),
      warehouseId: text(form, 'warehouseId'),
      date: optional(form, 'date'),
      notes: optional(form, 'notes'),
      currency: optional(form, 'currency'),
      exchangeRate: rate(form),
      priceListId: optional(form, 'priceListId'),
      lines: items
        .map((itemId, index) => ({
          itemId,
          unitId: units[index] ?? '',
          quantity: parseDecimal(quantities[index] ?? ''),
          // Precio en blanco: lo pone la lista. El servidor lo resuelve, tambien si hay que
          // convertirlo de la moneda de la lista a la del pedido.
          unitPrice: (prices[index] ?? '').trim() === '' ? null : parseDecimal(prices[index] ?? ''),
        }))
        .filter((line) => line.itemId !== ''),
    }),
  );
}

export async function changeOrder(_state: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');

  if (form.get('extra') === 'confirm') return attempt('No se pudo confirmar el pedido.', (token) => salesApi().confirmOrder(token, id));

  // Un pedido que solo vende servicios se factura sin pasar por un despacho.
  if (form.get('extra') === 'invoice-order') {
    return attempt('No se pudo emitir la factura.', (token) => salesApi().issueInvoice(token, { orderId: id }));
  }

  return attempt('No se pudo anular el pedido.', (token) => salesApi().cancelOrder(token, id));
}

// Crea un despacho si llega el pedido; si llega el id del despacho, edita ese borrador.
export async function saveDispatch(_state: FormState, form: FormData): Promise<FormState> {
  const orderLines = form.getAll('dispatchLine').map(String);
  const quantities = form.getAll('dispatchQuantity').map(String);
  const input = {
    date: optional(form, 'date'),
    notes: optional(form, 'notes'),
    lines: orderLines
      .map((orderLineId, index) => ({ orderLineId, raw: (quantities[index] ?? '').trim() }))
      .filter(({ raw }) => raw !== '' && raw !== '0')
      .map(({ orderLineId, raw }) => ({ orderLineId, quantity: parseDecimal(raw) })),
  };
  const dispatchId = optional(form, 'id');

  return attempt('No se pudo guardar el despacho.', (token) =>
    dispatchId ? salesApi().updateDispatch(token, dispatchId, input) : salesApi().createDispatch(token, text(form, 'orderId'), input),
  );
}

export async function changeDispatch(_state: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');
  const extra = form.get('extra');

  if (extra === 'confirm') return attempt('No se pudo confirmar el despacho.', (token) => salesApi().confirmDispatch(token, id));
  if (extra === 'invoice') return attempt('No se pudo emitir la factura.', (token) => salesApi().issueInvoice(token, { dispatchId: id }));

  return attempt('No se pudo anular el despacho.', (token) => salesApi().cancelDispatch(token, id));
}

export async function cancelInvoice(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('No se pudo anular la factura.', (token) => salesApi().cancelInvoice(token, text(form, 'id')));
}
