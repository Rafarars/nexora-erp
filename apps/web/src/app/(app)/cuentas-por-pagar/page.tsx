import { redirect } from 'next/navigation';
import { visiblePayablesSections } from '@/modules/payables/domain/payables-sections';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function PayablesIndexPage() {
  const { session } = await requireSession();
  const [first] = visiblePayablesSections(session);

  if (!first) {
    return (
      <p className="text-muted text-sm" data-testid="payables-forbidden">
        Tu rol no tiene permiso para ver las cuentas por pagar de esta empresa.
      </p>
    );
  }

  redirect(first.href);
}
