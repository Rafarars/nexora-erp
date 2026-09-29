import { PaymentsBoard } from '@/sections/payables/payments-board';
import { can } from '@/modules/access/domain/session';
import { readablePayablesError } from '@/modules/payables/domain/payables-error';
import { payablesApi } from '@/shared/session/payables-api';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';
import type { PayableInvoice } from '@/modules/payables/domain/payables';

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

  const canCreate = can(session, 'payables.payments.create');
  const canUpdate = can(session, 'payables.payments.update');

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
      purchasingApi().allSuppliers(token),
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

  const [payments, suppliers, currencies, settings] = loaded;

  // Facturas para asignar: en Fase 4 cargamos facturas confirmadas de compra como base
  let invoices: PayableInvoice[] = [];
  try {
    if (canCreate || canUpdate) {
      const purchaseInvoicesResult = await purchasingApi().searchInvoices(token, { status: 'confirmed' });
      const suppliersMap = new Map(suppliers.map((s) => [s.id, s]));
      invoices = purchaseInvoicesResult.invoices.map((inv) => {
        const sup = suppliersMap.get(inv.supplierId) ?? { id: inv.supplierId, code: '', name: 'Proveedor' };
        return {
          id: inv.id,
          code: inv.code,
          supplier: { id: sup.id, code: sup.code, name: sup.name },
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          currency: inv.currency,
          total: inv.total,
          paid: 0,
          balance: inv.total,
          companyBalance: inv.total,
          status: 'pending' as const,
        };
      });
    }
  } catch {
    // Si no tiene permiso de purchasing.invoices.search o falla, continua con lista vacia
    invoices = [];
  }

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
