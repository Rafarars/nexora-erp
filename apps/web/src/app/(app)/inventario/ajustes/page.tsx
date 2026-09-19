import { AdjustmentsBoard } from '@/sections/inventory/adjustments-board';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { companyApi } from '@/shared/session/company-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  bodega?: string;
  estado?: string;
  motivo?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function AdjustmentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();
  const { q, bodega, estado, motivo, desde, hasta, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  if (!can(session, 'inventory.adjustments.search')) {
    return (
      <p className="text-muted text-sm" data-testid="adjustments-forbidden">
        Tu rol no tiene permiso para ver los ajustes de esta empresa.
      </p>
    );
  }

  // El formulario necesita elegir articulos y bodegas: sin permiso para leerlos no se ofrece.
  const canPick = can(session, 'inventory.items.search') && can(session, 'catalog.warehouses.search');
  const canCreate = can(session, 'inventory.adjustments.create') && canPick;
  const canUpdate = can(session, 'inventory.adjustments.update') && canPick;
  // Los filtros por bodega necesitan la lista aunque no se pueda crear nada.
  const canListWarehouses = can(session, 'catalog.warehouses.search');

  const [adjustments, items, warehouses] = await Promise.all([
    inventoryApi().searchAdjustments(token, {
      q,
      warehouseId: bodega,
      status: estado,
      type: motivo,
      from: desde,
      to: hasta,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    canCreate || canUpdate ? inventoryApi().allItems(token) : [],
    canListWarehouses ? catalogApi().searchWarehouses(token) : [],
  ]);

  return (
    <AdjustmentsBoard
      adjustments={adjustments.adjustments}
      search={{
        q: q ?? '',
        warehouseId: bodega ?? '',
        status: estado ?? '',
        type: motivo ?? '',
        from: desde ?? '',
        to: hasta ?? '',
        page,
        pageSize: PAGE_SIZE,
        total: adjustments.total,
        hasMore: adjustments.hasMore,
      }}
      items={items}
      warehouses={warehouses}
      today={(await companyApi().settings(token)).today}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'inventory.adjustments.confirm')}
      canCancel={can(session, 'inventory.adjustments.cancel')}
    />
  );
}
