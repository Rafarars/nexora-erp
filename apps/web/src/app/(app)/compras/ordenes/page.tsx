import { OrdersBoard } from '@/sections/purchasing/orders-board';
import { can } from '@/modules/access/domain/session';
import { readablePurchasingError } from '@/modules/purchasing/domain/purchasing-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  proveedor?: string;
  bodega?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.orders.search')) {
    return (
      <p className="text-muted text-sm" data-testid="orders-forbidden">
        Tu rol no tiene permiso para ver las órdenes de compra de esta empresa.
      </p>
    );
  }

  const { q, proveedor, bodega, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  // El formulario elige proveedor, bodega y articulos: sin permiso para leerlos no se ofrece.
  const canPick =
    can(session, 'purchasing.suppliers.search') && can(session, 'inventory.items.search') && can(session, 'catalog.warehouses.search');
  const canCreate = can(session, 'purchasing.orders.create') && canPick;
  const canUpdate = can(session, 'purchasing.orders.update') && canPick;
  // Filtrar por proveedor o por bodega necesita sus listas aunque no se pueda crear nada.
  const canListSuppliers = can(session, 'purchasing.suppliers.search');
  const canListWarehouses = can(session, 'catalog.warehouses.search');

  let loaded;
  try {
    loaded = await Promise.all([
      purchasingApi().searchOrders(token, {
        q,
        supplierId: proveedor,
        warehouseId: bodega,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canListSuppliers ? purchasingApi().allSuppliers(token) : [],
      canCreate || canUpdate ? inventoryApi().allItems(token) : [],
      canListWarehouses ? catalogApi().searchWarehouses(token) : [],
      canCreate || canUpdate ? companyApi().currencies(token) : [],
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="orders-error">
        {readablePurchasingError(error, 'No se pudieron cargar las órdenes de compra.')}
      </p>
    );
  }

  const [orders, suppliers, items, warehouses, currencies, settings] = loaded;

  return (
    <OrdersBoard
      orders={orders.orders}
      search={{
        q: q ?? '',
        supplierId: proveedor ?? '',
        warehouseId: bodega ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: orders.total,
        hasMore: orders.hasMore,
      }}
      suppliers={suppliers}
      items={items}
      warehouses={warehouses}
      currencies={currencies}
      baseCurrency={settings.baseCurrency.code}
      allowsRateOverride={settings.allowsRateOverride}
      today={settings.today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'purchasing.orders.confirm')}
      canCancel={can(session, 'purchasing.orders.cancel')}
      canReceive={can(session, 'purchasing.receipts.create')}
    />
  );
}
