// PostgreSQL rechaza un duplicado aunque el dominio ya lo haya comprobado: dos altas
// simultaneas pasan las dos la comprobacion previa. Aqui se reconoce ese rechazo para
// traducirlo al error de dominio en vez de dejar salir un 500.
//
// Prisma lo informa distinto segun el motor: `meta.target` con el cliente clasico, o
// los campos de la restriccion dentro de `driverAdapterError` con un adaptador.
export function violatedUniqueFields(error: unknown): string[] | null {
  if (!isRecord(error) || error.code !== 'P2002') {
    return null;
  }

  const meta = isRecord(error.meta) ? error.meta : {};
  const target = meta.target;

  if (Array.isArray(target)) {
    return target.map(String);
  }

  if (typeof target === 'string') {
    return [target];
  }

  const adapter = isRecord(meta.driverAdapterError) ? meta.driverAdapterError : {};
  const cause = isRecord(adapter.cause) ? adapter.cause : {};
  const constraint = isRecord(cause.constraint) ? cause.constraint : {};

  if (Array.isArray(constraint.fields)) {
    return constraint.fields.map((field) => String(field).replaceAll('"', ''));
  }

  if (typeof constraint.index === 'string') {
    return [constraint.index];
  }

  return [];
}

// Cierto si la restriccion violada es la de esa columna. Llega como lista de campos
// (`['tenantId', 'name']`) o como nombre del indice (`categories_tenant_id_name_key`),
// segun el motor; se compara con el final exacto para que `name` no case con otra.
export function violates(error: unknown, field: string, column = field): boolean {
  const fields = violatedUniqueFields(error);

  if (fields === null) {
    return false;
  }

  return fields.some(
    (candidate) => candidate === field || candidate === column || candidate.endsWith(`_tenant_id_${column}_key`),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
