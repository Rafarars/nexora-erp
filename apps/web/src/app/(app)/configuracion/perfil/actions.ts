'use server';

import { revalidatePath } from 'next/cache';
import { readableError } from '@/modules/access/domain/access-error';
import { accessApi } from '@/shared/session/access-api';
import { requireSession } from '@/shared/session/current-session';
import type { FormState } from '@/shared/forms/form-state';

export async function updateProfile(_state: FormState, form: FormData): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await accessApi().updateProfile(token, String(form.get('name') ?? ''));
  } catch (error) {
    return { error: readableError(error, 'No se pudo guardar tu perfil.'), done: false };
  }

  revalidatePath('/', 'layout');

  return { error: null, done: true };
}

export async function changePassword(_state: FormState, form: FormData): Promise<FormState> {
  const { token } = await requireSession();

  const next = String(form.get('next') ?? '');

  if (next !== String(form.get('confirmation') ?? '')) {
    return { error: 'La nueva contraseña y su confirmación no coinciden.', done: false };
  }

  try {
    await accessApi().changePassword(token, String(form.get('current') ?? ''), next);
  } catch (error) {
    // Una contraseña actual incorrecta llega como credenciales invalidas.
    return { error: readableError(error, 'No se pudo cambiar la contraseña.'), done: false };
  }

  return { error: null, done: true };
}
