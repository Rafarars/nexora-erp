import { CategoriesTable } from '@/sections/catalog/categories-table';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'catalog.categories.search')) {
    return (
      <p className="text-muted text-sm" data-testid="categories-forbidden">
        Tu rol no tiene permiso para ver las categorías de esta empresa.
      </p>
    );
  }

  return (
    <CategoriesTable
      categories={await catalogApi().searchCategories(token)}
      canCreate={can(session, 'catalog.categories.create')}
      canUpdate={can(session, 'catalog.categories.update')}
      canDeactivate={can(session, 'catalog.categories.deactivate')}
    />
  );
}
