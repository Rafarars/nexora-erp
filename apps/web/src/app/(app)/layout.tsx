import { logout } from './actions';
import { Sidebar } from '@/sections/layout/sidebar';
import { TenantSwitcher } from '@/sections/layout/tenant-switcher';
import { requireSession } from '@/shared/session/current-session';

// La sesion se pide al servidor en cada navegacion: si le quitan un rol a alguien,
// la interfaz lo refleja en la siguiente pantalla.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireSession();

  return (
    <div className="flex min-h-full flex-1">
      <aside className="border-line hidden w-56 shrink-0 border-r p-4 sm:block">
        <p className="mb-6 px-3 text-sm font-semibold tracking-widest">NEXORA</p>
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line flex items-center justify-between gap-4 border-b px-6 py-3">
          <TenantSwitcher session={session} />

          <div className="flex items-center gap-4">
            <span className="text-muted text-sm" data-testid="current-user">
              {session.name}
            </span>
            <form action={logout}>
              <button type="submit" data-testid="logout" className="text-muted text-sm underline">
                Salir
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
