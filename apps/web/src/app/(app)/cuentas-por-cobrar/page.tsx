import { redirect } from 'next/navigation';
import { visibleReceivablesSections } from '@/modules/receivables/domain/receivables-sections';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function ReceivablesIndexPage() {
  const { session } = await requireSession();
  const [first] = visibleReceivablesSections(session);

  if (!first) {
    return (
      <p className="text-muted text-sm" data-testid="receivables-forbidden">
        Tu rol no tiene permiso para ver las cuentas por cobrar de esta empresa.
      </p>
    );
  }

  redirect(first.href);
}
