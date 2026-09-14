import { ReceivablesTable } from '@/sections/receivables/receivables-table';
import { can } from '@/modules/access/domain/session';
import { receivablesApi } from '@/shared/session/receivables-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function ReceivablesPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'receivables.balances.search')) {
    return (
      <p className="text-muted text-sm" data-testid="receivables-invoices-forbidden">
        Tu rol no tiene permiso para ver los saldos de esta empresa.
      </p>
    );
  }

  return <ReceivablesTable receivables={await receivablesApi().searchReceivables(token)} />;
}
