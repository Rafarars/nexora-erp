import { CreditNotesBoard } from '@/sections/receivables/credit-notes-board';
import { can } from '@/modules/access/domain/session';
import { readableReceivablesError } from '@/modules/receivables/domain/receivables-error';
import { companyApi } from '@/shared/session/company-api';
import { receivablesApi } from '@/shared/session/receivables-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface Params {
  q?: string;
  cliente?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function CreditNotesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'receivables.creditnotes.search')) {
    return (
      <p className="text-muted text-sm" data-testid="credit-notes-forbidden">
        Tu rol no tiene permiso para ver las notas de crédito de esta empresa.
      </p>
    );
  }

  const { q, cliente, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  const canCreate = can(session, 'receivables.creditnotes.create');
  const canUpdate = can(session, 'receivables.creditnotes.update');
  const canConfirm = can(session, 'receivables.creditnotes.confirm');
  const canCancel = can(session, 'receivables.creditnotes.cancel');

  let loaded;
  try {
    loaded = await Promise.all([
      receivablesApi().searchCreditNotes(token, {
        q,
        customerId: cliente,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canCreate || canUpdate ? receivablesApi().allReceivables(token) : [],
      receivablesApi().allCustomers(token),
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="credit-notes-error">
        {readableReceivablesError(error, 'No se pudieron cargar las notas de crédito.')}
      </p>
    );
  }

  const [creditNotes, receivables, customers, settings] = loaded;

  return (
    <CreditNotesBoard
      creditNotes={creditNotes.creditNotes}
      search={{
        q: q ?? '',
        customerId: cliente ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: creditNotes.total,
        hasMore: creditNotes.hasMore,
      }}
      receivables={receivables}
      customers={customers}
      today={settings.today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={canConfirm}
      canCancel={canCancel}
    />
  );
}
