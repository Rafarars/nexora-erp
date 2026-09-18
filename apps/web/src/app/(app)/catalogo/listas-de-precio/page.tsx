import { PriceListsTable } from '@/sections/catalog/price-lists-table';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function PriceListsPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'catalog.pricelists.search')) {
    return (
      <p className="text-muted text-sm" data-testid="price-lists-forbidden">
        Tu rol no tiene permiso para ver las listas de precio de esta empresa.
      </p>
    );
  }

  const canCreate = can(session, 'catalog.pricelists.create');
  const [priceLists, currencies] = await Promise.all([
    catalogApi().searchPriceLists(token),
    // Solo hacen falta para elegir la moneda de una lista nueva.
    canCreate ? companyApi().currencies(token) : [],
  ]);

  return (
    <PriceListsTable
      priceLists={priceLists}
      currencies={currencies.filter((currency) => currency.isActive)}
      canCreate={canCreate}
      canUpdate={can(session, 'catalog.pricelists.update')}
      canDeactivate={can(session, 'catalog.pricelists.deactivate')}
    />
  );
}
