import { DispatchesBoard } from '@/sections/sales/dispatches-board';
import { can } from '@/modules/access/domain/session';
import { readableSalesError } from '@/modules/sales/domain/sales-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { salesApi } from '@/shared/session/sales-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  bodega?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function DispatchesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.dispatches.search')) {
    return (
      <p className="text-muted text-sm" data-testid="dispatches-forbidden">
        Tu rol no tiene permiso para ver los despachos de esta empresa.
      </p>
    );
  }

  const { q, bodega, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);
  // Editar un borrador muestra lo pendiente de su pedido.
  const canUpdate = can(session, 'sales.dispatches.update') && can(session, 'sales.orders.search');

  let loaded;
  try {
    loaded = await Promise.all([
      salesApi().searchDispatches(token, {
        q,
        warehouseId: bodega,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canUpdate ? salesApi().allOrders(token) : [],
      can(session, 'catalog.warehouses.search') ? catalogApi().searchWarehouses(token) : [],
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="dispatches-error">
        {readableSalesError(error, 'No se pudieron cargar los despachos.')}
      </p>
    );
  }

  const [dispatches, orders, warehouses, settings] = loaded;

  return (
    <DispatchesBoard
      dispatches={dispatches.dispatches}
      search={{
        q: q ?? '',
        warehouseId: bodega ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: dispatches.total,
        hasMore: dispatches.hasMore,
      }}
      orders={orders}
      warehouses={warehouses}
      today={settings.today}
      canUpdate={canUpdate}
      canConfirm={can(session, 'sales.dispatches.confirm')}
      canCancel={can(session, 'sales.dispatches.cancel')}
      canInvoice={can(session, 'sales.invoices.issue')}
    />
  );
}
