import 'server-only';
import { redirect } from 'next/navigation';
import { AccessError } from '@/modules/access/domain/access-error';
import type { Session } from '@/modules/access/domain/session';
import { accessApi } from './access-api';
import { clearToken, readToken } from './session-cookie';

export interface ActiveSession {
  session: Session;
  token: string;
}

// Se recupera del servidor en cada peticion, no se guarda en la cookie: si a alguien
// le quitan un rol, la interfaz lo refleja en la siguiente pantalla y no cuando
// caduque la sesion.
export async function requireSession(): Promise<ActiveSession> {
  const token = await readToken();

  if (!token) {
    redirect('/login');
  }

  try {
    return { session: await accessApi().me(token), token };
  } catch (error) {
    if (error instanceof AccessError) {
      await clearToken();
      redirect('/login');
    }

    throw error;
  }
}
