import { redirect } from 'next/navigation';
import { visibleReportSections } from '@/modules/reports/domain/reports-sections';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function ReportsIndexPage() {
  const { session } = await requireSession();
  const [first] = visibleReportSections(session);

  if (!first) {
    return (
      <p className="text-muted text-sm" data-testid="reports-forbidden">
        Tu rol no tiene permiso para ver reportes de esta empresa.
      </p>
    );
  }

  redirect(first.href);
}
