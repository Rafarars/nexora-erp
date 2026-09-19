import { CustomersTable } from '@/sections/sales/customers-table';
import { can } from '@/modules/access/domain/session';
import { readableSalesError } from '@/modules/sales/domain/sales-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { salesApi } from '@/shared/session/sales-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  activo?: string;
  pagina?: string;
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.customers.search')) {
    return (
      <p className="text-muted text-sm" data-testid="customers-forbidden">
        Tu rol no tiene permiso para ver los clientes de esta empresa.
      </p>
    );
  }

  const { q, activo, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);
  const canUpdate = can(session, 'sales.customers.update');
  const canCreate = can(session, 'sales.customers.create');

  let loaded;
  try {
    loaded = await Promise.all([
      salesApi().searchCustomers(token, { q, active: activo, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
      // Sin permiso sobre las listas, el cliente se guarda con la que ya tenia.
      (canCreate || canUpdate) && can(session, 'catalog.pricelists.search') ? catalogApi().searchPriceLists(token) : [],
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="customers-error">
        {readableSalesError(error, 'No se pudieron cargar los clientes.')}
      </p>
    );
  }

  const [customers, priceLists] = loaded;

  return (
    <CustomersTable
      customers={customers.customers}
      search={{
        q: q ?? '',
        active: activo ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: customers.total,
        hasMore: customers.hasMore,
      }}
      priceLists={priceLists.filter((priceList) => priceList.isActive)}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDeactivate={can(session, 'sales.customers.deactivate')}
    />
  );
}
