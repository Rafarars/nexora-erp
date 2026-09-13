import { SuppliersTable } from '@/sections/purchasing/suppliers-table';
import { can } from '@/modules/access/domain/session';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.suppliers.search')) {
    return (
      <p className="text-muted text-sm" data-testid="suppliers-forbidden">
        Tu rol no tiene permiso para ver los proveedores de esta empresa.
      </p>
    );
  }

  return (
    <SuppliersTable
      suppliers={await purchasingApi().searchSuppliers(token)}
      canCreate={can(session, 'purchasing.suppliers.create')}
      canUpdate={can(session, 'purchasing.suppliers.update')}
      canDeactivate={can(session, 'purchasing.suppliers.deactivate')}
    />
  );
}
