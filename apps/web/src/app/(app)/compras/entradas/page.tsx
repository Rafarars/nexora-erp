import { ReceiptsBoard } from '@/sections/purchasing/receipts-board';
import { can } from '@/modules/access/domain/session';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function ReceiptsPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.receipts.search')) {
    return (
      <p className="text-muted text-sm" data-testid="receipts-forbidden">
        Tu rol no tiene permiso para ver las entradas de mercancía de esta empresa.
      </p>
    );
  }

  // Editar un borrador muestra lo pendiente de su orden.
  const canUpdate = can(session, 'purchasing.receipts.update') && can(session, 'purchasing.orders.search');
  const [receipts, orders] = await Promise.all([
    purchasingApi().searchReceipts(token),
    canUpdate ? purchasingApi().searchOrders(token) : [],
  ]);

  return (
    <ReceiptsBoard
      receipts={receipts}
      orders={orders}
      today={new Date().toISOString().slice(0, 10)}
      canUpdate={canUpdate}
      canConfirm={can(session, 'purchasing.receipts.confirm')}
      canCancel={can(session, 'purchasing.receipts.cancel')}
    />
  );
}
