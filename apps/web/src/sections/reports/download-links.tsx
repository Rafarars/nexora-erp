import { downloadHref } from '@/modules/reports/domain/reports';
import type { ReportFormat, ReportName } from '@/modules/reports/domain/reports';

const LABELS: Record<ReportFormat, string> = { pdf: 'Descargar PDF', xlsx: 'Descargar Excel' };

export function DownloadLinks({ report, formats = ['pdf', 'xlsx'], params = {} }: { report: ReportName; formats?: ReportFormat[]; params?: Record<string, string | undefined> }) {
  return (
    <div className="flex gap-2">
      {formats.map((format) => (
        <a
          key={format}
          href={downloadHref(report, format, params)}
          data-testid={`download-${report}-${format}`}
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
        >
          {LABELS[format]}
        </a>
      ))}
    </div>
  );
}
