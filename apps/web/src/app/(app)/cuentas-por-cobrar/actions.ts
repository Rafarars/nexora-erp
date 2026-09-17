'use server';

import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/modules/catalog/domain/catalog';
import { readableReceivablesError } from '@/modules/receivables/domain/receivables-error';
import { receivablesApi } from '@/shared/session/receivables-api';
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
    return { error: readableReceivablesError(error, fallback), done: false };
  }

  revalidatePath('/cuentas-por-cobrar', 'layout');

  return { error: null, done: true };
}

// Los montos vacios no son parte del cobro: solo se envian las facturas a las que se les aplica algo.
export async function savePayment(_state: FormState, form: FormData): Promise<FormState> {
  const invoices = form.getAll('allocationInvoice').map(String);
  const amounts = form.getAll('allocationAmount').map(String);

  return attempt('No se pudo guardar el cobro.', (token) =>
    receivablesApi().savePayment(token, optional(form, 'id'), {
      customerId: text(form, 'customerId'),
      date: optional(form, 'date'),
      method: text(form, 'method'),
      reference: optional(form, 'reference'),
      notes: optional(form, 'notes'),
      currency: optional(form, 'currency'),
      exchangeRate: rate(form),
      allocations: invoices
        .map((invoiceId, index) => ({ invoiceId, raw: (amounts[index] ?? '').trim() }))
        .filter(({ raw }) => raw !== '')
        .map(({ invoiceId, raw }) => ({ invoiceId, amount: parseDecimal(raw) })),
    }),
  );
}

export async function changePayment(_state: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');

  if (form.get('extra') === 'confirm') return attempt('No se pudo confirmar el cobro.', (token) => receivablesApi().confirmPayment(token, id));

  return attempt('No se pudo anular el cobro.', (token) => receivablesApi().cancelPayment(token, id));
}
