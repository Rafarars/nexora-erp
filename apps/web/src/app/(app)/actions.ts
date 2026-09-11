'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { AccessError } from '@/modules/access/domain/access-error';
import { accessApi } from '@/shared/session/access-api';
import { clearToken, readToken, storeToken } from '@/shared/session/session-cookie';

const SESSION_HOURS = 1;

// Cambiar de empresa reemite el token: la empresa activa la firma el servidor, no
// la elige el navegador mandando una cabecera.
export async function switchTenant(form: FormData): Promise<void> {
  const tenantId = String(form.get('tenantId') ?? '');
  const token = await readToken();

  if (!token || !tenantId) {
    redirect('/login');
  }

  try {
    const { token: reissued } = await accessApi().switchTenant(token, tenantId);

    await storeToken(reissued, SESSION_HOURS * 3600);
  } catch (error) {
    if (error instanceof AccessError) {
      await clearToken();
      redirect('/login');
    }

    throw error;
  }

  revalidatePath('/', 'layout');
}

export async function logout(): Promise<void> {
  await clearToken();
  redirect('/login');
}
