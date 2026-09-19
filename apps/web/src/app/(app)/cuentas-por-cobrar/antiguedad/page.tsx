import { AgingTable } from '@/sections/receivables/aging-table';
import { can } from '@/modules/access/domain/session';
import { readableReceivablesError } from '@/modules/receivables/domain/receivables-error';
import { receivablesApi } from '@/shared/session/receivables-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  saldo?: string;
  pagina?: string;
}

export default async function AgingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'receivables.balances.search')) {
    return (
      <p className="text-muted text-sm" data-testid="aging-forbidden">
        Tu rol no tiene permiso para ver los saldos de esta empresa.
      </p>
    );
  }

  const { q, saldo, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);
  const onlyWithBalance = saldo === 'false' ? 'false' : 'true';

  let balances;
  try {
    balances = await receivablesApi().searchCustomerBalances(token, {
      q,
      onlyWithBalance,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="aging-error">
        {readableReceivablesError(error, 'No se pudo cargar la antigüedad de saldos.')}
      </p>
    );
  }

  return (
    <AgingTable
      customers={balances.customers}
      totals={balances.totals}
      search={{
        q: q ?? '',
        onlyWithBalance: onlyWithBalance === 'true',
        page,
        pageSize: PAGE_SIZE,
        total: balances.total,
        hasMore: balances.hasMore,
      }}
      canReadStatement={can(session, 'receivables.statements.search')}
    />
  );
}
