import { TaxesTable } from '@/sections/catalog/taxes-table';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function TaxesPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'catalog.taxes.search')) {
    return (
      <p className="text-muted text-sm" data-testid="taxes-forbidden">
        Tu rol no tiene permiso para ver los impuestos de esta empresa.
      </p>
    );
  }

  return (
    <TaxesTable
      taxes={await catalogApi().searchTaxes(token)}
      canCreate={can(session, 'catalog.taxes.create')}
      canUpdate={can(session, 'catalog.taxes.update')}
      canDeactivate={can(session, 'catalog.taxes.deactivate')}
    />
  );
}
