import { AdminNav } from '@/sections/layout/admin-nav';

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Administración</h1>
        <p className="text-muted mt-1 text-sm">
          Quién entra a esta empresa y qué puede hacer cada quien.
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <AdminNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
