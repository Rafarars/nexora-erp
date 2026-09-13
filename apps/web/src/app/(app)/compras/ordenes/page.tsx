import { OrdersBoard } from '@/sections/purchasing/orders-board';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.orders.search')) {
    return (
      <p className="text-muted text-sm" data-testid="orders-forbidden">
        Tu rol no tiene permiso para ver las órdenes de compra de esta empresa.
      </p>
    );
  }

  // El formulario elige proveedor, bodega y articulos: sin permiso para leerlos no se ofrece.
  const canPick =
    can(session, 'purchasing.suppliers.search') && can(session, 'catalog.items.search') && can(session, 'catalog.warehouses.search');
  const canCreate = can(session, 'purchasing.orders.create') && canPick;
  const canUpdate = can(session, 'purchasing.orders.update') && canPick;

  const [orders, suppliers, items, warehouses] = await Promise.all([
    purchasingApi().searchOrders(token),
    canCreate || canUpdate ? purchasingApi().searchSuppliers(token) : [],
    canCreate || canUpdate ? catalogApi().searchItems(token) : [],
    canCreate || canUpdate ? catalogApi().searchWarehouses(token) : [],
  ]);

  return (
    <OrdersBoard
      orders={orders}
      suppliers={suppliers}
      items={items}
      warehouses={warehouses}
      today={new Date().toISOString().slice(0, 10)}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'purchasing.orders.confirm')}
      canCancel={can(session, 'purchasing.orders.cancel')}
      canReceive={can(session, 'purchasing.receipts.create')}
    />
  );
}
