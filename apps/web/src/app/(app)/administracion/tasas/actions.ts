'use server';

import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/modules/catalog/domain/catalog';
import { readableCompanyError } from '@/modules/company/domain/company-error';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';
import type { FormState } from '@/shared/forms/form-state';

const text = (form: FormData, name: string) => String(form.get(name) ?? '');
const optional = (form: FormData, name: string) => text(form, name).trim() || null;

async function attempt(fallback: string, work: (token: string) => Promise<void>): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await work(token);
  } catch (error) {
    return { error: readableCompanyError(error, fallback), done: false };
  }

  revalidatePath('/administracion/tasas');

  return { error: null, done: true };
}

// Cargar la misma moneda, fecha y tipo otra vez corrige la tasa: la API decide si crea o corrige.
export async function recordExchangeRate(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('No se pudo guardar la tasa.', (token) =>
    companyApi().recordRate(token, {
      currency: text(form, 'currency'),
      rateDate: text(form, 'rateDate'),
      type: text(form, 'type'),
      rate: parseDecimal(text(form, 'rate')),
      source: optional(form, 'source'),
    }),
  );
}

export async function changeExchangeRateStatus(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('No se pudo cambiar el estado de la tasa.', (token) =>
    companyApi().changeRateStatus(token, text(form, 'id'), form.get('active') === 'true'),
  );
}
