import { ReceivablesTable } from '@/sections/receivables/receivables-table';
import { can } from '@/modules/access/domain/session';
import { readableReceivablesError } from '@/modules/receivables/domain/receivables-error';
import { companyApi } from '@/shared/session/company-api';
import { receivablesApi } from '@/shared/session/receivables-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  cliente?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  vencidas?: string;
  pagina?: string;
}

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'receivables.balances.search')) {
    return (
      <p className="text-muted text-sm" data-testid="receivables-invoices-forbidden">
        Tu rol no tiene permiso para ver los saldos de esta empresa.
      </p>
    );
  }

  const { q, cliente, estado, desde, hasta, vencidas, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  let loaded;
  try {
    loaded = await Promise.all([
      receivablesApi().searchReceivables(token, {
        q,
        customerId: cliente,
        status: estado,
        from: desde,
        to: hasta,
        onlyOverdue: vencidas === 'true' ? 'true' : undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      receivablesApi().allCustomers(token),
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="receivables-error">
        {readableReceivablesError(error, 'No se pudieron cargar las facturas por cobrar.')}
      </p>
    );
  }

  const [receivables, customers, settings] = loaded;

  return (
    <ReceivablesTable
      receivables={receivables.receivables}
      search={{
        q: q ?? '',
        customerId: cliente ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        onlyOverdue: vencidas === 'true',
        page,
        pageSize: PAGE_SIZE,
        total: receivables.total,
        hasMore: receivables.hasMore,
      }}
      customers={customers}
      baseCurrency={settings.baseCurrency.code}
    />
  );
}
