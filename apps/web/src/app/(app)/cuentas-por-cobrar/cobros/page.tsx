import { PaymentsBoard } from '@/sections/receivables/payments-board';
import { can } from '@/modules/access/domain/session';
import { receivablesApi } from '@/shared/session/receivables-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'receivables.payments.search')) {
    return (
      <p className="text-muted text-sm" data-testid="payments-forbidden">
        Tu rol no tiene permiso para ver los cobros de esta empresa.
      </p>
    );
  }

  // Para registrar un cobro hay que ver que facturas deben.
  const canPick = can(session, 'receivables.balances.search');
  const canCreate = can(session, 'receivables.payments.create') && canPick;
  const canUpdate = can(session, 'receivables.payments.update') && canPick;

  const [payments, receivables] = await Promise.all([
    receivablesApi().searchPayments(token),
    canCreate || canUpdate ? receivablesApi().searchReceivables(token) : [],
  ]);

  return (
    <PaymentsBoard
      payments={payments}
      receivables={receivables}
      today={(await companyApi().settings(token)).today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'receivables.payments.confirm')}
      canCancel={can(session, 'receivables.payments.cancel')}
    />
  );
}
