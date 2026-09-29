import { AgingTable } from '@/sections/payables/aging-table';
import { can } from '@/modules/access/domain/session';
import { readablePayablesError } from '@/modules/payables/domain/payables-error';
import { payablesApi } from '@/shared/session/payables-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface Params {
  q?: string;
  conSaldo?: string;
  pagina?: string;
}

export default async function AgingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'payables.balances.search')) {
    return (
      <p className="text-muted text-sm" data-testid="aging-forbidden">
        Tu rol no tiene permiso para ver los saldos de esta empresa.
      </p>
    );
  }

  const { q, conSaldo, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);
  const onlyWithBalance = conSaldo === 'false' ? 'false' : 'true';

  let balances;
  try {
    balances = await payablesApi().searchSupplierBalances(token, {
      q,
      onlyWithBalance,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="aging-error">
        {readablePayablesError(error, 'No se pudo cargar la antigüedad de saldos.')}
      </p>
    );
  }

  return (
    <AgingTable
      suppliers={balances.suppliers}
      totals={balances.totals}
      search={{
        q: q ?? '',
        onlyWithBalance: onlyWithBalance === 'true',
        page,
        pageSize: PAGE_SIZE,
        total: balances.total,
        hasMore: balances.hasMore,
      }}
      canReadStatement={can(session, 'payables.statements.search')}
    />
  );
}
