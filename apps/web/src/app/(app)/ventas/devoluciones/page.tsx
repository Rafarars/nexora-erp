import { can } from '@/modules/access/domain/session';
import { readableSalesError } from '@/modules/sales/domain/sales-error';
import { SalesReturnsBoard } from '@/sections/sales/sales-returns-board';
import { catalogApi } from '@/shared/session/catalog-api';
import { companyApi } from '@/shared/session/company-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { requireSession } from '@/shared/session/current-session';
import { salesApi } from '@/shared/session/sales-api';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface Params {
  q?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function SalesReturnsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.returns.search')) {
    return (
      <p className="text-muted text-sm" data-testid="sales-returns-forbidden">
        Tu rol no tiene permiso para ver las devoluciones de venta de esta empresa.
      </p>
    );
  }

  const { q, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  const canCreate = can(session, 'sales.returns.create');
  const canUpdate = can(session, 'sales.returns.update');
  const canMutate = canCreate || canUpdate;

  let loaded;
  try {
    loaded = await Promise.all([
      salesApi().searchReturns(token, {
        q,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canMutate
        ? salesApi()
            .searchDispatches(token, { status: 'confirmed', limit: 50 })
            .then((res) => res.dispatches)
        : [],
      canMutate && can(session, 'sales.customers.search') ? salesApi().allCustomers(token) : [],
      canMutate && can(session, 'catalog.warehouses.search') ? catalogApi().searchWarehouses(token) : [],
      canMutate && can(session, 'inventory.items.search') ? inventoryApi().allItems(token) : [],
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="sales-returns-error">
        {readableSalesError(error, 'No se pudieron cargar las devoluciones de venta.')}
      </p>
    );
  }

  const [returnsPage, dispatches, customers, warehouses, items, settings] = loaded;

  return (
    <SalesReturnsBoard
      returns={returnsPage.returns}
      search={{
        q: q ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: returnsPage.total,
        hasMore: returnsPage.hasMore,
      }}
      dispatches={dispatches}
      customers={customers}
      warehouses={warehouses}
      items={items}
      today={settings.today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'sales.returns.confirm')}
      canCancel={can(session, 'sales.returns.cancel')}
    />
  );
}
