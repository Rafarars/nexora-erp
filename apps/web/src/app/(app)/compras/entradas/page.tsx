import { ReceiptsBoard } from '@/sections/purchasing/receipts-board';
import { can } from '@/modules/access/domain/session';
import { readablePurchasingError } from '@/modules/purchasing/domain/purchasing-error';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.receipts.search')) {
    return (
      <p className="text-muted text-sm" data-testid="receipts-forbidden">
        Tu rol no tiene permiso para ver las entradas de mercancía de esta empresa.
      </p>
    );
  }

  const { q, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);
  // Editar un borrador muestra lo pendiente de su orden.
  const canUpdate = can(session, 'purchasing.receipts.update') && can(session, 'purchasing.orders.search');

  let loaded;
  try {
    loaded = await Promise.all([
      purchasingApi().searchReceipts(token, {
        q,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canUpdate ? purchasingApi().allOrders(token) : [],
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="receipts-error">
        {readablePurchasingError(error, 'No se pudieron cargar las entradas de mercancía.')}
      </p>
    );
  }

  const [receipts, orders, settings] = loaded;

  return (
    <ReceiptsBoard
      receipts={receipts.receipts}
      search={{
        q: q ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: receipts.total,
        hasMore: receipts.hasMore,
      }}
      orders={orders}
      baseCurrency={settings.baseCurrency.code}
      allowsRateOverride={settings.allowsRateOverride}
      today={settings.today}
      canUpdate={canUpdate}
      canConfirm={can(session, 'purchasing.receipts.confirm')}
      canCancel={can(session, 'purchasing.receipts.cancel')}
    />
  );
}
