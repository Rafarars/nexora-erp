import { SalesOrdersBoard } from '@/sections/sales/sales-orders-board';
import { can } from '@/modules/access/domain/session';
import { readableSalesError } from '@/modules/sales/domain/sales-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { salesApi } from '@/shared/session/sales-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  cliente?: string;
  bodega?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function SalesOrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.orders.search')) {
    return (
      <p className="text-muted text-sm" data-testid="sales-orders-forbidden">
        Tu rol no tiene permiso para ver los pedidos de esta empresa.
      </p>
    );
  }

  const { q, cliente, bodega, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  const canPick = can(session, 'sales.customers.search') && can(session, 'inventory.items.search') && can(session, 'catalog.warehouses.search');
  const canCreate = can(session, 'sales.orders.create') && canPick;
  const canUpdate = can(session, 'sales.orders.update') && canPick;
  // Filtrar por cliente o por bodega necesita sus listas aunque no se pueda crear nada.
  const canListCustomers = can(session, 'sales.customers.search');
  const canListWarehouses = can(session, 'catalog.warehouses.search');

  let loaded;
  try {
    loaded = await Promise.all([
      salesApi().searchOrders(token, {
        q,
        customerId: cliente,
        warehouseId: bodega,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canListCustomers ? salesApi().allCustomers(token) : [],
      canCreate || canUpdate ? inventoryApi().allItems(token) : [],
      canListWarehouses ? catalogApi().searchWarehouses(token) : [],
      canCreate || canUpdate ? companyApi().currencies(token) : [],
      (canCreate || canUpdate) && can(session, 'catalog.pricelists.search') ? catalogApi().searchPriceLists(token) : [],
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="sales-orders-error">
        {readableSalesError(error, 'No se pudieron cargar los pedidos.')}
      </p>
    );
  }

  const [orders, customers, items, warehouses, currencies, priceLists, settings] = loaded;
  const active = priceLists.filter((priceList) => priceList.isActive);

  return (
    <SalesOrdersBoard
      orders={orders.orders}
      search={{
        q: q ?? '',
        customerId: cliente ?? '',
        warehouseId: bodega ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: orders.total,
        hasMore: orders.hasMore,
      }}
      customers={customers}
      items={items}
      warehouses={warehouses}
      currencies={currencies}
      priceLists={active}
      defaultPriceListId={active.find((priceList) => priceList.isDefault)?.id ?? null}
      priceDecimals={settings.priceDecimals}
      baseCurrency={settings.baseCurrency.code}
      allowsRateOverride={settings.allowsRateOverride}
      today={settings.today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'sales.orders.confirm')}
      canCancel={can(session, 'sales.orders.cancel')}
      canDispatch={can(session, 'sales.dispatches.create')}
      canInvoice={can(session, 'sales.invoices.create')}
    />
  );
}
