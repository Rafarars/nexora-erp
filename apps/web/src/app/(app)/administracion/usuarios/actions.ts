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

export async function assignRole(_state: FormState, form: FormData): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await accessApi().assignRole(token, String(form.get('userId')), String(form.get('roleId')));
  } catch (error) {
    return { error: readableError(error, 'No se pudo asignar el rol.'), done: false };
  }

  revalidatePath('/administracion/usuarios');

  return { error: null, done: true };
}

export async function revokeRole(_state: FormState, form: FormData): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await accessApi().revokeRole(token, String(form.get('userId')), String(form.get('roleId')));
  } catch (error) {
    return { error: readableError(error, 'No se pudo retirar el rol.'), done: false };
  }

  revalidatePath('/administracion/usuarios');

  return { error: null, done: true };
}
