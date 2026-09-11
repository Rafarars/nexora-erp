import Link from 'next/link';
import { AccountMenu } from '@/sections/layout/account-menu';
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
      <aside className="border-line hidden w-60 shrink-0 flex-col border-r p-4 sm:flex">
        <p className="mb-6 px-3 text-sm font-semibold tracking-widest">NEXORA</p>

        <div className="flex-1">
          <Sidebar />
        </div>

        {/* Fuera de la zona con sesion: se consulta cuando el sistema esta caido. */}
        <Link
          href="/estado"
          data-testid="nav-estado"
          className="text-muted hover:text-foreground mb-2 block px-3 py-2 text-xs"
        >
          Estado del sistema
        </Link>

        <AccountMenu name={session.name} email={session.email} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line flex items-center justify-between gap-4 border-b px-6 py-3">
          <TenantSwitcher session={session} />
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
