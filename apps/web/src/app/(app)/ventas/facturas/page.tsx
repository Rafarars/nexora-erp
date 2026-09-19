import { InvoicesBoard } from '@/sections/sales/invoices-board';
import { can } from '@/modules/access/domain/session';
import { readableSalesError } from '@/modules/sales/domain/sales-error';
import { salesApi } from '@/shared/session/sales-api';
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

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.invoices.search')) {
    return (
      <p className="text-muted text-sm" data-testid="invoices-forbidden">
        Tu rol no tiene permiso para ver las facturas de esta empresa.
      </p>
    );
  }

  const { q, cliente, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  let loaded;
  try {
    loaded = await Promise.all([
      salesApi().searchInvoices(token, {
        q,
        customerId: cliente,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      // Filtrar por cliente necesita su lista completa.
      can(session, 'sales.customers.search') ? salesApi().allCustomers(token) : [],
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="invoices-error">
        {readableSalesError(error, 'No se pudieron cargar las facturas.')}
      </p>
    );
  }

  const [invoices, customers] = loaded;

  return (
    <InvoicesBoard
      invoices={invoices.invoices}
      search={{
        q: q ?? '',
        customerId: cliente ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: invoices.total,
        hasMore: invoices.hasMore,
      }}
      customers={customers}
      canCancel={can(session, 'sales.invoices.cancel')}
    />
  );
}
