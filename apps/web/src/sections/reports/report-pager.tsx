import Link from 'next/link';
import { pageLabel } from '@/modules/reports/domain/reports';
import type { ReportPage } from '@/modules/reports/domain/reports';

// Pasar de pagina sin perder los filtros: la pantalla envia los mismos parametros y cambia el
// desplazamiento. Los totales del reporte no cambian de una pagina a otra, por eso el pie los
// sigue enseñando completos.
export function ReportPager({ page, params, testId }: { page: ReportPage; params: Record<string, string | undefined>; testId: string }) {
  const { visible, label } = pageLabel(page);

  if (!visible) return null;

  const hrefFor = (offset: number) => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    if (offset > 0) query.set('desde_fila', String(offset));

    return `?${query.toString()}`;
  };

  return (
    <div className="text-muted flex items-center justify-between text-sm" data-testid={`${testId}-pager`}>
      <span data-testid={`${testId}-pager-count`}>
        {label}
      </span>
      <div className="flex gap-2">
        {page.offset > 0 ? (
          <Link href={hrefFor(Math.max(0, page.offset - page.limit))} data-testid={`${testId}-pager-previous`} className="border-line rounded-md border px-3 py-1.5">
            Anteriores
          </Link>
        ) : null}
        {page.hasMore ? (
          <Link href={hrefFor(page.offset + page.limit)} data-testid={`${testId}-pager-next`} className="border-line rounded-md border px-3 py-1.5">
            Siguientes
          </Link>
        ) : null}
      </div>
    </div>
  );
}
