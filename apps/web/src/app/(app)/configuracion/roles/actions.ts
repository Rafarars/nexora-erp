'use server';

import { revalidatePath } from 'next/cache';
import { accessApi } from '@/shared/session/access-api';
import { requireSession } from '@/shared/session/current-session';
import { readableError } from '@/modules/access/domain/access-error';
import type { FormState } from '@/shared/forms/form-state';

export async function saveRole(_state: FormState, form: FormData): Promise<FormState> {
  const { token } = await requireSession();

  const roleId = String(form.get('roleId') ?? '');
  const role = {
    name: String(form.get('name') ?? ''),
    // Las casillas marcadas llegan como una lista: se manda el conjunto entero, no
    // un diff, asi que desmarcar quita el permiso sin pasos adicionales.
    permissions: form.getAll('permissions').map(String),
  };

  try {
    if (roleId) {
      await accessApi().updateRole(token, roleId, role);
    } else {
      await accessApi().createRole(token, role);
    }
  } catch (error) {
    return { error: readableError(error, 'No se pudo guardar el rol.'), done: false };
  }

  revalidatePath('/configuracion/roles');
  revalidatePath('/configuracion/usuarios');

  return { error: null, done: true };
}
