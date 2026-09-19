import { PaymentsBoard } from '@/sections/receivables/payments-board';
import { can } from '@/modules/access/domain/session';
import { readableReceivablesError } from '@/modules/receivables/domain/receivables-error';
import { receivablesApi } from '@/shared/session/receivables-api';
import { companyApi } from '@/shared/session/company-api';
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
  pagina?: string;
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'receivables.payments.search')) {
    return (
      <p className="text-muted text-sm" data-testid="payments-forbidden">
        Tu rol no tiene permiso para ver los cobros de esta empresa.
      </p>
    );
  }

  const { q, cliente, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  // Para registrar un cobro hay que ver que facturas deben.
  const canPick = can(session, 'receivables.balances.search');
  const canCreate = can(session, 'receivables.payments.create') && canPick;
  const canUpdate = can(session, 'receivables.payments.update') && canPick;

  let loaded;
  try {
    loaded = await Promise.all([
      receivablesApi().searchPayments(token, {
        q,
        customerId: cliente,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      // El formulario elige entre todas las facturas que deben, no entre las de la pagina.
      canCreate || canUpdate ? receivablesApi().allReceivables(token) : [],
      canPick ? receivablesApi().allCustomers(token) : [],
      canCreate || canUpdate ? companyApi().currencies(token) : [],
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="payments-error">
        {readableReceivablesError(error, 'No se pudieron cargar los cobros.')}
      </p>
    );
  }

  const [payments, receivables, customers, currencies, settings] = loaded;

  return (
    <PaymentsBoard
      payments={payments.payments}
      search={{
        q: q ?? '',
        customerId: cliente ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: payments.total,
        hasMore: payments.hasMore,
      }}
      receivables={receivables}
      customers={customers}
      currencies={currencies}
      settings={settings}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'receivables.payments.confirm')}
      canCancel={can(session, 'receivables.payments.cancel')}
    />
  );
}
