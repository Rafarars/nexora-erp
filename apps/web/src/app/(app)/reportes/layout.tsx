import { SectionNav } from '@/sections/shared/section-nav';
import { visibleReportSections } from '@/modules/reports/domain/reports-sections';
import { requireSession } from '@/shared/session/current-session';

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Reportes</h1>
        <p className="text-muted mt-1 text-sm">Lo mismo que muestran los módulos, listo para descargar en PDF o Excel.</p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <SectionNav label="Reportes" testId="reports-nav" sections={visibleReportSections(session).map(({ href, label, testId }) => ({ href, label, testId }))} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
