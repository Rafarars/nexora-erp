import { ItemsBoard } from '@/sections/catalog/items-board';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function ItemsPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'catalog.items.search')) {
    return (
      <p className="text-muted text-sm" data-testid="items-forbidden">
        Tu rol no tiene permiso para ver los artículos de esta empresa.
      </p>
    );
  }

  const canCreate = can(session, 'catalog.items.create');
  const canUpdate = can(session, 'catalog.items.update');
  const api = catalogApi();

  // El formulario necesita las opciones, y consultarlas exige su propio permiso. Sin el,
  // no se puede elegir y el formulario no se ofrece: mejor que un selector vacio.
  const canPickOptions =
    can(session, 'catalog.categories.search') && can(session, 'catalog.taxes.search') && can(session, 'catalog.units.search');
  const editable = (canCreate || canUpdate) && canPickOptions;

  const [items, categories, taxes, units] = await Promise.all([
    api.searchItems(token),
    editable ? api.searchCategories(token) : [],
    editable ? api.searchTaxes(token) : [],
    editable ? api.searchUnits(token) : [],
  ]);

  return (
    <ItemsBoard
      items={items}
      categories={categories}
      taxes={taxes}
      units={units}
      canCreate={canCreate && canPickOptions}
      canUpdate={canUpdate && canPickOptions}
      canDeactivate={can(session, 'catalog.items.deactivate')}
    />
  );
}
