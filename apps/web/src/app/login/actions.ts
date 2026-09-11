'use server';

import { redirect } from 'next/navigation';
import { readableError } from '@/modules/access/domain/access-error';
import { accessApi } from '@/shared/session/access-api';
import { storeToken } from '@/shared/session/session-cookie';

export interface LoginState {
  error: string | null;
}

const SESSION_HOURS = 1;

// El token se pone en una cookie httpOnly DESDE EL SERVIDOR: el navegador nunca lo
// ve, asi que ningun script de la pagina puede leerlo ni llevarselo.
export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Escribe tu correo y tu contraseña.' };
  }

  try {
    const { token } = await accessApi().login(email, password);

    await storeToken(token, SESSION_HOURS * 3600);
  } catch (error) {
    return {
      error: readableError(error, 'No se pudo contactar con el servidor. Inténtalo de nuevo.'),
    };
  }

  // Fuera del try: `redirect` funciona lanzando, y el catch se lo tragaria.
  redirect('/');
}
