import { can } from '@/modules/access/domain/session';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function PanelPage() {
  const { session } = await requireSession();

  const summary = [
    { label: 'Empresa activa', value: session.tenantName, testId: 'panel-tenant' },
    { label: 'Tu cuenta', value: session.email, testId: 'panel-email' },
    {
      label: 'Empresas a las que perteneces',
      value: String(session.availableTenants.length),
      testId: 'panel-tenant-count',
    },
    {
      label: 'Tus permisos',
      value: session.grantsAll ? 'Todos (administrador)' : String(session.permissions.length),
      testId: 'panel-permissions',
    },
  ];

  return (
    <section className="space-y-6" data-testid="panel">
      <div>
        <h1 className="text-lg font-semibold">Panel</h1>
        <p className="text-muted mt-1 text-sm">
          Estás trabajando en {session.tenantName}. Todo lo que veas aquí pertenece a esta empresa.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {summary.map((item) => (
          <div key={item.label} className="border-line rounded-lg border p-4">
            <dt className="text-muted text-xs uppercase tracking-wide">{item.label}</dt>
            <dd className="mt-1 text-sm font-medium" data-testid={item.testId}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      {can(session, 'access.users.search') ? null : (
        <p className="text-muted text-sm" data-testid="panel-no-access">
          Tu rol no tiene permiso para consultar los usuarios de esta empresa.
        </p>
      )}
    </section>
  );
}
