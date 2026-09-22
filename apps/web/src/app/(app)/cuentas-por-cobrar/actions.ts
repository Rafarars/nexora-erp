'use server';

import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/modules/catalog/domain/catalog';
import { readableReceivablesError } from '@/modules/receivables/domain/receivables-error';
import type { CreditNoteReason } from '@/modules/receivables/domain/receivables';
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
      creditSourceId: optional(form, 'creditSourceId'),
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

export async function saveCreditNote(_state: FormState, form: FormData): Promise<FormState> {
  const lineConcepts = form.getAll('lineConcept').map(String);
  const lineQuantities = form.getAll('lineQuantity').map(String);
  const linePrices = form.getAll('linePrice').map(String);
  const lineTaxes = form.getAll('lineTax').map(String);

  return attempt('No se pudo guardar la nota de crédito.', (token) =>
    receivablesApi().saveCreditNote(token, optional(form, 'id'), {
      customerId: text(form, 'customerId'),
      invoiceId: optional(form, 'invoiceId'),
      salesReturnId: optional(form, 'salesReturnId'),
      issueDate: optional(form, 'issueDate'),
      reason: text(form, 'reason') as CreditNoteReason,
      reasonDetail: optional(form, 'reasonDetail'),
      notes: optional(form, 'notes'),
      currency: optional(form, 'currency'),
      exchangeRate: rate(form),
      lines: lineConcepts.map((concept, index) => ({
        concept: concept.trim() || null,
        quantity: parseDecimal(lineQuantities[index] ?? '1'),
        unitPrice: parseDecimal(linePrices[index] ?? '0'),
        taxRate: parseDecimal(lineTaxes[index] ?? '0'),
      })),
    }),
  );
}

export async function changeCreditNote(_state: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');

  if (form.get('extra') === 'confirm') return attempt('No se pudo confirmar la nota de crédito.', (token) => receivablesApi().confirmCreditNote(token, id));

  return attempt('No se pudo anular la nota de crédito.', (token) => receivablesApi().cancelCreditNote(token, id));
}
