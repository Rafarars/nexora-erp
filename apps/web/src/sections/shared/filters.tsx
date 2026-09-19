import Link from 'next/link';

// Un filtro con su etiqueta. `block` no es decoracion: sin el, la etiqueta se pega al control.
export function Filter({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

// "1–20 de 57" y el paso de pagina. `href` decide que filtros conserva cada enlace.
export function Pager({
  testId,
  page,
  pageSize,
  count,
  total,
  hasMore,
  href,
}: {
  testId: string;
  page: number;
  pageSize: number;
  count: number;
  total: number;
  hasMore: boolean;
  href: (page: number) => string;
}) {
  // Sin filas no hay rango: una pagina pasada del final diria "21-20 de 2".
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = count === 0 ? 0 : (page - 1) * pageSize + count;

  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <span className="text-muted" data-testid={`${testId}-page-range`}>
        {from}–{to} de {total}
      </span>
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          data-testid={`${testId}-page-previous`}
          className="border-line hover:bg-surface rounded-md border px-3 py-2"
        >
          Anterior
        </Link>
      ) : null}
      {hasMore ? (
        <Link
          href={href(page + 1)}
          data-testid={`${testId}-page-next`}
          className="border-line hover:bg-surface rounded-md border px-3 py-2"
        >
          Siguiente
        </Link>
      ) : null}
    </div>
  );
}
