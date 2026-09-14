import { AgingTable } from '@/sections/receivables/aging-table';
import { can } from '@/modules/access/domain/session';
import { receivablesApi } from '@/shared/session/receivables-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function AgingPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'receivables.balances.search')) {
    return (
      <p className="text-muted text-sm" data-testid="aging-forbidden">
        Tu rol no tiene permiso para ver los saldos de esta empresa.
      </p>
    );
  }

  const { customers, totals } = await receivablesApi().searchCustomerBalances(token);

  return <AgingTable customers={customers} totals={totals} canReadStatement={can(session, 'receivables.statements.search')} />;
}
