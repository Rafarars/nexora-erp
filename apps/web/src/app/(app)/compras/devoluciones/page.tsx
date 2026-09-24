import { can } from '@/modules/access/domain/session';
import { readablePurchasingError } from '@/modules/purchasing/domain/purchasing-error';
import { PurchaseReturnsBoard } from '@/sections/purchasing/purchase-returns-board';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';
import { purchasingApi } from '@/shared/session/purchasing-api';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface Params {
  q?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function PurchaseReturnsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.returns.search')) {
    return (
      <p className="text-muted text-sm" data-testid="purchase-returns-forbidden">
        Tu rol no tiene permiso para ver las devoluciones de compra de esta empresa.
      </p>
    );
  }

  const { q, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  const canCreate = can(session, 'purchasing.returns.create');
  const canUpdate = can(session, 'purchasing.returns.update');
  const canMutate = canCreate || canUpdate;

  let loaded;
  try {
    loaded = await Promise.all([
      purchasingApi().searchReturns(token, {
        q,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canMutate
        ? purchasingApi()
            .searchReceipts(token, { status: 'confirmed', limit: 50 })
            .then((res) => res.receipts)
        : [],
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="purchase-returns-error">
        {readablePurchasingError(error, 'No se pudieron cargar las devoluciones de compra.')}
      </p>
    );
  }

  const [returnsPage, receipts, settings] = loaded;

  return (
    <PurchaseReturnsBoard
      returns={returnsPage.returns}
      search={{
        q: q ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: returnsPage.total,
        hasMore: returnsPage.hasMore,
      }}
      receipts={receipts}
      today={settings.today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'purchasing.returns.confirm')}
      canCancel={can(session, 'purchasing.returns.cancel')}
    />
  );
}
