import { redirect } from 'next/navigation';
import { visiblePurchasingSections } from '@/modules/purchasing/domain/purchasing-sections';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function PurchasingIndexPage() {
  const { session } = await requireSession();
  const [first] = visiblePurchasingSections(session);

  if (!first) {
    return (
      <p className="text-muted text-sm" data-testid="purchasing-forbidden">
        Tu rol no tiene permiso para ver las compras de esta empresa.
      </p>
    );
  }

  redirect(first.href);
}
