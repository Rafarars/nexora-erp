'use server';

import { revalidatePath } from 'next/cache';
import { readableAccountingError } from '@/modules/accounting/domain/accounting-error';
import { accountingApi } from '@/shared/session/accounting-api';
import { requireSession } from '@/shared/session/current-session';
import type { FormState } from '@/shared/forms/form-state';
import type { AccountType } from '@/modules/accounting/domain/accounting';

const text = (form: FormData, name: string) => String(form.get(name) ?? '');
const optional = (form: FormData, name: string) => text(form, name).trim() || null;

async function attempt(fallback: string, work: (token: string) => Promise<void>): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await work(token);
  } catch (error) {
    return { error: readableAccountingError(error, fallback), done: false };
  }

  revalidatePath('/contabilidad', 'layout');

  return { error: null, done: true };
}

export async function saveAccount(_state: FormState, form: FormData): Promise<FormState> {
  const id = optional(form, 'id');
  const code = text(form, 'code');
  const name = text(form, 'name');
  const type = text(form, 'type') as AccountType;
  const acceptsEntries = form.get('acceptsEntries') === 'true';
  const parentId = optional(form, 'parentId');

  return attempt('No se pudo guardar la cuenta contable.', (token) => {
    if (id) {
      return accountingApi().updateAccount(token, id, {
        name,
        acceptsEntries,
      });
    }
    return accountingApi().createAccount(token, {
      code,
      name,
      type,
      acceptsEntries,
      parentId,
    }).then(() => undefined);
  });
}

export async function changeAccountStatus(_state: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');
  const isActive = form.get('isActive') === 'true';

  return attempt('No se pudo cambiar el estado de la cuenta.', (token) =>
    accountingApi().changeAccountStatus(token, id, isActive),
  );
}

export async function getEntryDetail(id: string) {
  const { token } = await requireSession();
  return accountingApi().getEntry(token, id);
}
