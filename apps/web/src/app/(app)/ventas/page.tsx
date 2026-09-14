import { redirect } from 'next/navigation';
import { visibleSalesSections } from '@/modules/sales/domain/sales-sections';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function SalesIndexPage() {
  const { session } = await requireSession();
  const [first] = visibleSalesSections(session);

  if (!first) {
    return (
      <p className="text-muted text-sm" data-testid="sales-forbidden">
        Tu rol no tiene permiso para ver las ventas de esta empresa.
      </p>
    );
  }

  redirect(first.href);
}
