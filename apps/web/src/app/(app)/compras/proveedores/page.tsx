import { SuppliersTable } from '@/sections/purchasing/suppliers-table';
import { can } from '@/modules/access/domain/session';
import { readablePurchasingError } from '@/modules/purchasing/domain/purchasing-error';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  activo?: string;
  pagina?: string;
}

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.suppliers.search')) {
    return (
      <p className="text-muted text-sm" data-testid="suppliers-forbidden">
        Tu rol no tiene permiso para ver los proveedores de esta empresa.
      </p>
    );
  }

  const { q, activo, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  let suppliers;
  try {
    suppliers = await purchasingApi().searchSuppliers(token, {
      q,
      active: activo,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="suppliers-error">
        {readablePurchasingError(error, 'No se pudieron cargar los proveedores.')}
      </p>
    );
  }

  return (
    <SuppliersTable
      suppliers={suppliers.suppliers}
      search={{
        q: q ?? '',
        active: activo ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: suppliers.total,
        hasMore: suppliers.hasMore,
      }}
      canCreate={can(session, 'purchasing.suppliers.create')}
      canUpdate={can(session, 'purchasing.suppliers.update')}
      canDeactivate={can(session, 'purchasing.suppliers.deactivate')}
    />
  );
}
