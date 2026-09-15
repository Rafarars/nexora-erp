'use server';

import { revalidatePath } from 'next/cache';
import { readableCompanyError } from '@/modules/company/domain/company-error';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';
import type { FormState } from '@/shared/forms/form-state';

const text = (form: FormData, name: string) => String(form.get(name) ?? '');
const optional = (form: FormData, name: string) => text(form, name).trim() || null;
// Un entero escrito a mano; lo que no lo es viaja como NaN y la API senala el campo.
const whole = (form: FormData, name: string) => (/^\s*\d+\s*$/.test(text(form, name)) ? Number(text(form, name)) : Number.NaN);

async function attempt(fallback: string, work: (token: string) => Promise<void>): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await work(token);
  } catch (error) {
    return { error: readableCompanyError(error, fallback), done: false };
  }

  // La moneda, los decimales y el dia de hoy se ven en todas las pantallas.
  revalidatePath('/', 'layout');

  return { error: null, done: true };
}

export async function saveCompanyProfile(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('No se pudieron guardar los datos de la empresa.', (token) =>
    companyApi().saveProfile(token, {
      legalName: text(form, 'legalName'),
      tradeName: optional(form, 'tradeName'),
      fiscalId: optional(form, 'fiscalId'),
      address: optional(form, 'address'),
      phone: optional(form, 'phone'),
      email: optional(form, 'email'),
    }),
  );
}

export async function saveCompanySettings(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('No se pudieron guardar los parámetros.', (token) =>
    companyApi().saveSettings(token, {
      baseCurrency: text(form, 'baseCurrency'),
      secondaryCurrency: optional(form, 'secondaryCurrency'),
      timeZone: text(form, 'timeZone'),
      amountDecimals: whole(form, 'amountDecimals'),
      priceDecimals: whole(form, 'priceDecimals'),
      rateType: text(form, 'rateType'),
    }),
  );
}
