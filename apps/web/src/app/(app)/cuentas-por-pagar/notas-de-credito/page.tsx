import { CreditNotesBoard } from '@/sections/payables/credit-notes-board';
import { can } from '@/modules/access/domain/session';
import { readablePayablesError } from '@/modules/payables/domain/payables-error';
import { payablesApi } from '@/shared/session/payables-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface Params {
  q?: string;
  proveedor?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function CreditNotesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'payables.creditnotes.search')) {
    return (
      <p className="text-muted text-sm" data-testid="credit-notes-forbidden">
        Tu rol no tiene permiso para ver las notas de crédito de esta empresa.
      </p>
    );
  }

  const { q, proveedor, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  const canCreate = can(session, 'payables.creditnotes.create');
  const canUpdate = can(session, 'payables.creditnotes.update');
  const canConfirm = can(session, 'payables.creditnotes.confirm');
  const canCancel = can(session, 'payables.creditnotes.cancel');

  let loaded;
  try {
    loaded = await Promise.all([
      payablesApi().searchCreditNotes(token, {
        q,
        supplierId: proveedor,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canCreate || canUpdate ? payablesApi().allInvoices(token) : [],
      payablesApi().allSuppliers(token),
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="credit-notes-error">
        {readablePayablesError(error, 'No se pudieron cargar las notas de crédito.')}
      </p>
    );
  }

  const [creditNotes, invoices, suppliers, settings] = loaded;

  return (
    <CreditNotesBoard
      creditNotes={creditNotes.creditNotes}
      search={{
        q: q ?? '',
        supplierId: proveedor ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: creditNotes.total,
        hasMore: creditNotes.hasMore,
      }}
      invoices={invoices}
      suppliers={suppliers}
      today={settings.today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={canConfirm}
      canCancel={canCancel}
    />
  );
}
