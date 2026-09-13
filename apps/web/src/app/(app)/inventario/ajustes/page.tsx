import { AdjustmentsBoard } from '@/sections/inventory/adjustments-board';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function AdjustmentsPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'inventory.adjustments.search')) {
    return (
      <p className="text-muted text-sm" data-testid="adjustments-forbidden">
        Tu rol no tiene permiso para ver los ajustes de esta empresa.
      </p>
    );
  }

  // El formulario necesita elegir articulos y bodegas: sin permiso para leerlos no se ofrece.
  const canPick = can(session, 'catalog.items.search') && can(session, 'catalog.warehouses.search');
  const canCreate = can(session, 'inventory.adjustments.create') && canPick;
  const canUpdate = can(session, 'inventory.adjustments.update') && canPick;

  const [adjustments, items, warehouses] = await Promise.all([
    inventoryApi().searchAdjustments(token),
    canCreate || canUpdate ? catalogApi().searchItems(token) : [],
    canCreate || canUpdate ? catalogApi().searchWarehouses(token) : [],
  ]);

  return (
    <AdjustmentsBoard
      adjustments={adjustments}
      items={items}
      warehouses={warehouses}
      today={new Date().toISOString().slice(0, 10)}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canConfirm={can(session, 'inventory.adjustments.confirm')}
      canCancel={can(session, 'inventory.adjustments.cancel')}
    />
  );
}
