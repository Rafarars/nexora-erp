import { redirect } from 'next/navigation';
import { visibleCatalogSections } from '@/modules/catalog/domain/catalog-sections';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Sin portada propia: se entra por la primera seccion que el rol puede ver.
export default async function CatalogIndexPage() {
  const { session } = await requireSession();
  const [first] = visibleCatalogSections(session);

  if (!first) {
    return (
      <p className="text-muted text-sm" data-testid="catalog-forbidden">
        Tu rol no tiene permiso para ver el catálogo de esta empresa.
      </p>
    );
  }

  redirect(first.href);
}
