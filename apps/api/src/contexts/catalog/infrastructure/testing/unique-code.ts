// La base rechaza dos registros con el mismo codigo en una empresa. El contador lo
// evita en la practica, pero el doble tiene que rechazarlo igual: si no, una prueba que
// reutiliza un codigo pasaria en memoria y fallaria contra PostgreSQL.
export function ensureUniqueCode(
  rows: { id: string; tenantId: string; code: string }[],
  row: { id: string; tenantId: string; code: string },
): void {
  if (rows.some((other) => other.id !== row.id && other.tenantId === row.tenantId && other.code === row.code)) {
    throw new Error(`Code <${row.code}> already exists in tenant <${row.tenantId}>.`);
  }
}
