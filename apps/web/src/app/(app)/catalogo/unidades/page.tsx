import { UnitsTable } from '@/sections/catalog/units-table';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function UnitsPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'catalog.units.search')) {
    return (
      <p className="text-muted text-sm" data-testid="units-forbidden">
        Tu rol no tiene permiso para ver las unidades de medida de esta empresa.
      </p>
    );
  }

  return (
    <UnitsTable
      units={await catalogApi().searchUnits(token)}
      canCreate={can(session, 'catalog.units.create')}
      canUpdate={can(session, 'catalog.units.update')}
      canDeactivate={can(session, 'catalog.units.deactivate')}
    />
  );
}
