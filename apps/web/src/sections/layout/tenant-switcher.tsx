import { switchTenant } from '@/app/(app)/actions';
import type { Session } from '@/modules/access/domain/session';
import { belongsToSeveralTenants } from '@/modules/access/domain/session';

// Con una sola empresa no hay nada que elegir: se muestra el nombre y ya.
export function TenantSwitcher({ session }: { session: Session }) {
  if (!belongsToSeveralTenants(session)) {
    return (
      <span className="text-sm font-medium" data-testid="active-tenant">
        {session.tenantName}
      </span>
    );
  }

  return (
    <form action={switchTenant} className="flex items-center gap-2">
      <label htmlFor="tenantId" className="sr-only">
        Empresa activa
      </label>
      {/* La `key` fuerza a rehacer el desplegable al cambiar de empresa: sin ella
          React conserva el valor que el navegador ya tenia y el selector muestra la
          empresa anterior aunque el contenido sea el de la nueva. */}
      <select
        key={session.tenantId}
        id="tenantId"
        name="tenantId"
        defaultValue={session.tenantId}
        data-testid="tenant-switcher"
        className="border-line bg-background rounded-md border px-2 py-1 text-sm"
      >
        {session.availableTenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        data-testid="tenant-switch-submit"
        className="border-line rounded-md border px-2 py-1 text-sm"
      >
        Cambiar
      </button>
      <span className="sr-only" data-testid="active-tenant">
        {session.tenantName}
      </span>
    </form>
  );
}
