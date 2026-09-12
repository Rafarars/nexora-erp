'use server';

import { revalidatePath } from 'next/cache';
import { readableError } from '@/modules/access/domain/access-error';
import { accessApi } from '@/shared/session/access-api';
import { requireSession } from '@/shared/session/current-session';
import type { FormState } from '@/shared/forms/form-state';

export async function createUser(_state: FormState, form: FormData): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await accessApi().createUser(token, {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      roleIds: form.getAll('roleIds').map(String),
    });
  } catch (error) {
    return { error: readableError(error, 'No se pudo dar de alta a la persona.'), done: false };
  }

  revalidatePath('/administracion/usuarios');

  return { error: null, done: true };
}

export async function updateUser(_state: FormState, form: FormData): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await accessApi().updateUser(token, String(form.get('userId')), {
      name: String(form.get('name') ?? ''),
      roleIds: form.getAll('roleIds').map(String),
    });
  } catch (error) {
    return { error: readableError(error, 'No se pudieron guardar los cambios.'), done: false };
  }

  revalidatePath('/administracion/usuarios');

  return { error: null, done: true };
}

export async function changeUserStatus(_state: FormState, form: FormData): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await accessApi().changeUserStatus(
      token,
      String(form.get('userId')),
      form.get('active') === 'true',
    );
  } catch (error) {
    return { error: readableError(error, 'No se pudo cambiar el estado.'), done: false };
  }

  revalidatePath('/administracion/usuarios');

  return { error: null, done: true };
}

