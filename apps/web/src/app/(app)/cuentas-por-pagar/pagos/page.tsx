import { PaymentsBoard } from '@/sections/payables/payments-board';
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

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'payables.payments.search')) {
    return (
      <p className="text-muted text-sm" data-testid="payments-forbidden">
        Tu rol no tiene permiso para ver los pagos de esta empresa.
      </p>
    );
  }

  const { q, proveedor, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  // Para registrar o editar un pago hay que ver las facturas pendientes
  const canPick = can(session, 'payables.balances.search');
  const canCreate = can(session, 'payables.payments.create') && canPick;
  const canUpdate = can(session, 'payables.payments.update') && canPick;

  let loaded;
  try {
    loaded = await Promise.all([
      payablesApi().searchPayments(token, {
        q,
        supplierId: proveedor,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canCreate || canUpdate ? payablesApi().allInvoices(token) : [],
      canPick ? payablesApi().allSuppliers(token) : [],
      canCreate || canUpdate ? companyApi().currencies(token) : [],
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="payments-error">
        {readablePayablesError(error, 'No se pudieron cargar los pagos.')}
      </p>
    );
  }

  const [payments, invoices, suppliers, currencies, settings] = loaded;

  return (
    <PaymentsBoard
      payments={payments.payments}
      search={{
        q: q ?? '',
        supplierId: proveedor ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: payments.total,
        hasMore: payments.hasMore,
      }}
      invoices={invoices}
      suppliers={suppliers}
      currencies={currencies}
      settings={settings}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'payables.payments.confirm')}
      canCancel={can(session, 'payables.payments.cancel')}
    />
  );
}
