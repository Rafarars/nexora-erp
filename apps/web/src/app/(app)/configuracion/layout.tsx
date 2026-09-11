import { SettingsNav } from '@/sections/layout/settings-nav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Configuración</h1>
        <p className="text-muted mt-1 text-sm">
          Quién entra a esta empresa, qué puede hacer cada quien y tu propia cuenta.
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
