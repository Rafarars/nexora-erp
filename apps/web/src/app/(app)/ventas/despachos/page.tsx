import { DispatchesBoard } from '@/sections/sales/dispatches-board';
import { can } from '@/modules/access/domain/session';
import { salesApi } from '@/shared/session/sales-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function DispatchesPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.dispatches.search')) {
    return (
      <p className="text-muted text-sm" data-testid="dispatches-forbidden">
        Tu rol no tiene permiso para ver los despachos de esta empresa.
      </p>
    );
  }

  const canUpdate = can(session, 'sales.dispatches.update') && can(session, 'sales.orders.search');
  const [dispatches, orders] = await Promise.all([salesApi().searchDispatches(token), canUpdate ? salesApi().searchOrders(token) : []]);

  return (
    <DispatchesBoard
      dispatches={dispatches}
      orders={orders}
      today={(await companyApi().settings(token)).today}
      canUpdate={canUpdate}
      canConfirm={can(session, 'sales.dispatches.confirm')}
      canCancel={can(session, 'sales.dispatches.cancel')}
      canInvoice={can(session, 'sales.invoices.issue')}
    />
  );
}
