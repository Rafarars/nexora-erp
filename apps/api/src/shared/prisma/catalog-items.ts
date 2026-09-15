import type { TransactionClient } from './document-stock-posting.js';

// Lenguaje publicado por el catalogo para quien confirma documentos o mueve existencia. Bloquea en
// modo compartido los articulos que el documento usa y los devuelve como estan en ese instante.
// Cambiar un articulo bloquea su fila para escribir: el cambio espera a que el documento termine,
// o el documento espera al cambio y lo ve. Los bloqueos van ordenados para no cruzarse.
export interface LockedCatalogItem {
  id: string;
  isActive: boolean;
  type: 'inventoried' | 'service';
  // El factor de una unidad del articulo, o null si ya no la tiene.
  factorOf(unitId: string): number | null;
}

export async function lockCatalogItems(tx: TransactionClient, tenantId: string, itemIds: string[]): Promise<Map<string, LockedCatalogItem>> {
  const ids = [...new Set(itemIds)].sort();
  const items = new Map<string, LockedCatalogItem>();

  if (ids.length === 0) return items;

  const rows = await tx.$queryRaw<{ id: string; is_active: boolean; type: 'inventoried' | 'service' }[]>`
    SELECT id::text AS id, is_active, type::text AS type
    FROM items
    WHERE tenant_id = ${tenantId}::uuid AND id = ANY(${ids}::uuid[])
    ORDER BY id
    FOR SHARE`;
  const units = await tx.itemUnit.findMany({
    where: { tenantId, itemId: { in: ids } },
    select: { itemId: true, unitId: true, conversionFactor: true },
  });

  for (const row of rows) {
    const factors = new Map(units.filter((unit) => unit.itemId === row.id).map((unit) => [unit.unitId, unit.conversionFactor.toNumber()]));

    items.set(row.id, { id: row.id, isActive: row.is_active, type: row.type, factorOf: (unitId) => factors.get(unitId) ?? null });
  }

  return items;
}
