import { CustomersTable } from '@/sections/sales/customers-table';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { salesApi } from '@/shared/session/sales-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.customers.search')) {
    return (
      <p className="text-muted text-sm" data-testid="customers-forbidden">
        Tu rol no tiene permiso para ver los clientes de esta empresa.
      </p>
    );
  }

  const canUpdate = can(session, 'sales.customers.update');
  const canCreate = can(session, 'sales.customers.create');
  const [customers, priceLists] = await Promise.all([
    salesApi().searchCustomers(token),
    // Sin permiso sobre las listas, el cliente se guarda con la que ya tenia.
    (canCreate || canUpdate) && can(session, 'catalog.pricelists.search') ? catalogApi().searchPriceLists(token) : [],
  ]);

  return (
    <CustomersTable
      customers={customers}
      priceLists={priceLists.filter((priceList) => priceList.isActive)}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDeactivate={can(session, 'sales.customers.deactivate')}
    />
  );
}
