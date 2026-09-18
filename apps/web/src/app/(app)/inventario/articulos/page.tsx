import { ItemsBoard } from '@/sections/inventory/items-board';
import { can } from '@/modules/access/domain/session';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { session, token } = await requireSession();
  const { q, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);

  if (!can(session, 'inventory.items.search')) {
    return (
      <p className="text-muted text-sm" data-testid="items-forbidden">
        Tu rol no tiene permiso para ver los artículos de esta empresa.
      </p>
    );
  }

  const canCreate = can(session, 'inventory.items.create');
  const canUpdate = can(session, 'inventory.items.update');
  const catalog = catalogApi();

  // El formulario necesita las opciones del catalogo, y consultarlas exige su propio permiso. Sin el,
  // no se puede elegir y el formulario no se ofrece: mejor que un selector vacio.
  const canPickOptions =
    can(session, 'catalog.categories.search') && can(session, 'catalog.taxes.search') && can(session, 'catalog.units.search');
  const editable = (canCreate || canUpdate) && canPickOptions;

  const [page20, categories, taxes, units] = await Promise.all([
    inventoryApi().searchItems(token, { q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    editable ? catalog.searchCategories(token) : [],
    editable ? catalog.searchTaxes(token) : [],
    editable ? catalog.searchUnits(token) : [],
  ]);

  return (
    <ItemsBoard
      items={page20.items}
      search={{ q: q ?? '', page, pageSize: PAGE_SIZE, total: page20.total, hasMore: page20.hasMore }}
      categories={categories}
      taxes={taxes}
      units={units}
      canCreate={canCreate && canPickOptions}
      canUpdate={canUpdate && canPickOptions}
      canDeactivate={can(session, 'inventory.items.deactivate')}
    />
  );
}
