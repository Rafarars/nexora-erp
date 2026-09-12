import { ProfileForms } from '@/sections/access/profile-forms';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { session } = await requireSession();

  // Fuera de Administracion: es la cuenta de quien la usa, no algo de la empresa.
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Mi perfil</h1>
        <p className="text-muted mt-1 text-sm">Tu cuenta, igual en todas las empresas.</p>
      </div>
      <ProfileForms name={session.name} email={session.email} />
    </div>
  );
}
