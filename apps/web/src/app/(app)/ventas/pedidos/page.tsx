import { SalesOrdersBoard } from '@/sections/sales/sales-orders-board';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { salesApi } from '@/shared/session/sales-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function SalesOrdersPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.orders.search')) {
    return (
      <p className="text-muted text-sm" data-testid="sales-orders-forbidden">
        Tu rol no tiene permiso para ver los pedidos de esta empresa.
      </p>
    );
  }

  const canPick = can(session, 'sales.customers.search') && can(session, 'inventory.items.search') && can(session, 'catalog.warehouses.search');
  const canCreate = can(session, 'sales.orders.create') && canPick;
  const canUpdate = can(session, 'sales.orders.update') && canPick;

  const [orders, customers, items, warehouses] = await Promise.all([
    salesApi().searchOrders(token),
    canCreate || canUpdate ? salesApi().searchCustomers(token) : [],
    canCreate || canUpdate ? inventoryApi().searchItems(token) : [],
    canCreate || canUpdate ? catalogApi().searchWarehouses(token) : [],
  ]);

  return (
    <SalesOrdersBoard
      orders={orders}
      customers={customers}
      items={items}
      warehouses={warehouses}
      today={new Date().toISOString().slice(0, 10)}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'sales.orders.confirm')}
      canCancel={can(session, 'sales.orders.cancel')}
      canDispatch={can(session, 'sales.dispatches.create')}
    />
  );
}
