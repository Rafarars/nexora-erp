import { WarehousesTable } from '@/sections/catalog/warehouses-table';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function WarehousesPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'catalog.warehouses.search')) {
    return (
      <p className="text-muted text-sm" data-testid="warehouses-forbidden">
        Tu rol no tiene permiso para ver las bodegas de esta empresa.
      </p>
    );
  }

  return (
    <WarehousesTable
      warehouses={await catalogApi().searchWarehouses(token)}
      canCreate={can(session, 'catalog.warehouses.create')}
      canUpdate={can(session, 'catalog.warehouses.update')}
      canDeactivate={can(session, 'catalog.warehouses.deactivate')}
    />
  );
}
