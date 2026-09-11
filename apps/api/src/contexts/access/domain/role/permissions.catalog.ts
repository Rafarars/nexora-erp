// Los permisos que EXISTEN en este contexto. El codigo es la fuente de verdad: se
// declaran junto al contexto que los usa, no repartidos por el historial de
// migraciones. `make migrate` los sincroniza en la base con un upsert idempotente.
//
// Al crear un modulo nuevo: declarar aqui su permiso ANTES de usarlo en un
// @RequirePermission, o el endpoint quedaria inalcanzable — ningun rol puede tener
// un permiso que no esta en el catalogo.
export interface PermissionDefinition {
  code: string;
  description: string;
}

export const ACCESS_PERMISSIONS: PermissionDefinition[] = [
  { code: 'access.users.create', description: 'Dar de alta a una persona en la empresa' },
  { code: 'access.users.search', description: 'Listar los usuarios de la empresa' },
  { code: 'access.roles.assign', description: 'Asignar un rol a un miembro' },
  { code: 'access.roles.create', description: 'Crear roles en la empresa' },
  { code: 'access.roles.search', description: 'Listar los roles de la empresa' },
];
