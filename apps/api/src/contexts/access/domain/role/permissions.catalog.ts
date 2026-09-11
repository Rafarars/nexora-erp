// Los permisos que EXISTEN en este contexto. El codigo es la fuente de verdad: se
// declaran junto al contexto que los usa, no repartidos por el historial de
// migraciones. `make migrate` los sincroniza en la base con un upsert idempotente.
//
// Al crear un modulo nuevo: declarar aqui su permiso ANTES de usarlo en un
// @RequirePermission, o el endpoint quedaria inalcanzable — ningun rol puede tener
// un permiso que no esta en el catalogo.
//
// Y solo lo que YA usa algun endpoint: `route-declaration.spec.ts` cruza las dos
// listas en ambas direcciones, asi que un permiso declarado por si acaso hace fallar
// la suite. Un permiso que nadie exige es basura que alguien acabara concediendo.
export interface PermissionDefinition {
  code: string;
  description: string;
}

export const ACCESS_PERMISSIONS: PermissionDefinition[] = [
  { code: 'access.users.create', description: 'Dar de alta a una persona en la empresa' },
  { code: 'access.users.search', description: 'Listar los usuarios de la empresa' },
  { code: 'access.roles.search', description: 'Consultar los roles y sus permisos' },
  { code: 'access.roles.create', description: 'Crear roles en la empresa' },
  { code: 'access.roles.update', description: 'Cambiar el nombre y los permisos de un rol' },
  { code: 'access.roles.assign', description: 'Asignar y retirar roles a un miembro' },
];

// Concede un permiso que no existe y la clave ajena lo rechazaria en la base con un
// error ilegible. Se comprueba antes, contra la unica fuente de verdad.
export function isKnownPermission(code: string): boolean {
  return ACCESS_PERMISSIONS.some((permission) => permission.code === code);
}
