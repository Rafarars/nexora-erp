import { SalesOrdersBoard } from '@/sections/sales/sales-orders-board';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { salesApi } from '@/shared/session/sales-api';
import { companyApi } from '@/shared/session/company-api';
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

  const [orders, customers, items, warehouses, currencies, settings] = await Promise.all([
    salesApi().searchOrders(token),
    canCreate || canUpdate ? salesApi().searchCustomers(token) : [],
    canCreate || canUpdate ? inventoryApi().allItems(token) : [],
    canCreate || canUpdate ? catalogApi().searchWarehouses(token) : [],
    canCreate || canUpdate ? companyApi().currencies(token) : [],
    companyApi().settings(token),
  ]);

  return (
    <SalesOrdersBoard
      orders={orders}
      customers={customers}
      items={items}
      warehouses={warehouses}
      currencies={currencies}
      baseCurrency={settings.baseCurrency.code}
      allowsRateOverride={settings.allowsRateOverride}
      today={settings.today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'sales.orders.confirm')}
      canCancel={can(session, 'sales.orders.cancel')}
      canDispatch={can(session, 'sales.dispatches.create')}
    />
  );
}
