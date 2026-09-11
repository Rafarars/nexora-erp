import 'server-only';
import { cookies } from 'next/headers';

const COOKIE = 'nexora_session';

// httpOnly: el navegador guarda el token pero NINGUN JavaScript de la pagina puede
// leerlo, asi que un script inyectado no se lo lleva. sameSite lax corta el uso del
// token desde otro sitio web.
export async function storeToken(token: string, maxAgeSeconds: number): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export async function readToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function clearToken(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
