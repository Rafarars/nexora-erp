import { redirect } from 'next/navigation';
import { can } from '@/modules/access/domain/session';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// La administracion no tiene portada propia: se entra por la primera seccion que el rol puede ver.
export default async function AdministrationIndexPage() {
  const { session } = await requireSession();

  if (can(session, 'access.users.search')) redirect('/administracion/usuarios');
  if (can(session, 'access.roles.search')) redirect('/administracion/roles');

  redirect('/administracion/empresa');
}
