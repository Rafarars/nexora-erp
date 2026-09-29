import { PayablesTable } from '@/sections/payables/payables-table';
import { can } from '@/modules/access/domain/session';
import { readablePayablesError } from '@/modules/payables/domain/payables-error';
import { companyApi } from '@/shared/session/company-api';
import { payablesApi } from '@/shared/session/payables-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface Params {
  q?: string;
  proveedor?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  vencidas?: string;
  pagina?: string;
}

export default async function PayablesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'payables.balances.search')) {
    return (
      <p className="text-muted text-sm" data-testid="payables-invoices-forbidden">
        Tu rol no tiene permiso para ver los saldos de esta empresa.
      </p>
    );
  }

  const { q, proveedor, estado, desde, hasta, vencidas, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  let loaded;
  try {
    loaded = await Promise.all([
      payablesApi().searchPayableInvoices(token, {
        q,
        supplierId: proveedor,
        status: estado,
        from: desde,
        to: hasta,
        onlyOverdue: vencidas === 'true' ? 'true' : undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      payablesApi().allSuppliers(token),
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="payables-error">
        {readablePayablesError(error, 'No se pudieron cargar las facturas por pagar.')}
      </p>
    );
  }

  const [invoices, suppliers, settings] = loaded;

  return (
    <PayablesTable
      invoices={invoices.invoices}
      search={{
        q: q ?? '',
        supplierId: proveedor ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        onlyOverdue: vencidas === 'true',
        page,
        pageSize: PAGE_SIZE,
        total: invoices.total,
        hasMore: invoices.hasMore,
      }}
      suppliers={suppliers}
      baseCurrency={settings.baseCurrency.code}
    />
  );
}
