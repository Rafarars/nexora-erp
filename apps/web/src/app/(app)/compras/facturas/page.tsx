import { can } from '@/modules/access/domain/session';
import { readablePurchasingError } from '@/modules/purchasing/domain/purchasing-error';
import { PurchaseInvoicesBoard } from '@/sections/purchasing/purchase-invoices-board';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';
import { purchasingApi } from '@/shared/session/purchasing-api';

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

export default async function PurchaseInvoicesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.invoices.search')) {
    return (
      <p className="text-muted text-sm" data-testid="purchase-invoices-forbidden">
        Tu rol no tiene permiso para ver las facturas de compra de esta empresa.
      </p>
    );
  }

  const { q, proveedor, estado, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  const canCreate = can(session, 'purchasing.invoices.create');
  const canUpdate = can(session, 'purchasing.invoices.update');
  const canMutate = canCreate || canUpdate;
  const canSearchSuppliers = can(session, 'purchasing.suppliers.search');
  const canSearchReceipts = can(session, 'purchasing.receipts.search');

  let loaded;
  try {
    loaded = await Promise.all([
      purchasingApi().searchInvoices(token, {
        q,
        supplierId: proveedor,
        status: estado,
        from: desde,
        to: hasta,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      canSearchSuppliers ? purchasingApi().allSuppliers(token) : [],
      canMutate && canSearchReceipts
        ? purchasingApi()
            .searchReceipts(token, { status: 'confirmed', limit: 50 })
            .then((res) => res.receipts)
        : [],
      canMutate ? companyApi().currencies(token) : [],
      companyApi().settings(token),
    ]);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="purchase-invoices-error">
        {readablePurchasingError(error, 'No se pudieron cargar las facturas de compra.')}
      </p>
    );
  }

  const [invoicesPage, suppliers, receipts, currencies, settings] = loaded;

  return (
    <PurchaseInvoicesBoard
      invoices={invoicesPage.invoices}
      search={{
        q: q ?? '',
        supplierId: proveedor ?? '',
        status: estado ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: invoicesPage.total,
        hasMore: invoicesPage.hasMore,
      }}
      suppliers={suppliers}
      receipts={receipts}
      currencies={currencies}
      baseCurrency={settings.baseCurrency.code}
      allowsRateOverride={settings.allowsRateOverride}
      today={settings.today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'purchasing.invoices.confirm')}
      canCancel={can(session, 'purchasing.invoices.cancel')}
    />
  );
}
