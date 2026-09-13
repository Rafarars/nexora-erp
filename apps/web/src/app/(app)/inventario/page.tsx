import { redirect } from 'next/navigation';
import { visibleInventorySections } from '@/modules/inventory/domain/inventory-sections';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function InventoryIndexPage() {
  const { session } = await requireSession();
  const [first] = visibleInventorySections(session);

  if (!first) {
    return (
      <p className="text-muted text-sm" data-testid="inventory-forbidden">
        Tu rol no tiene permiso para ver el inventario de esta empresa.
      </p>
    );
  }

  redirect(first.href);
}
