// Los permisos que EXISTEN en el sistema. El codigo es la fuente de verdad: se declaran
// aqui, no repartidos por el historial de migraciones, y `make migrate` los sincroniza
// en la base con un upsert idempotente.
//
// Viven en `access` aunque protejan endpoints de otros contextos: autorizar es trabajo
// de este contexto, y los demas solo nombran el permiso en su @RequirePermission. Cada
// contexto tiene su propia lista para que se lea de quien es cada permiso.
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
  { code: 'access.users.update', description: 'Editar el nombre y los roles de una persona' },
  { code: 'access.users.deactivate', description: 'Desactivar y reactivar a una persona en la empresa' },
  { code: 'access.roles.search', description: 'Consultar los roles y sus permisos' },
  { code: 'access.roles.create', description: 'Crear roles en la empresa' },
  { code: 'access.roles.update', description: 'Cambiar el nombre y los permisos de un rol' },
  { code: 'access.roles.assign', description: 'Asignar y retirar roles a un miembro' },
];

export const CATALOG_PERMISSIONS: PermissionDefinition[] = [
  { code: 'catalog.categories.search', description: 'Consultar las categorías' },
  { code: 'catalog.categories.create', description: 'Crear categorías' },
  { code: 'catalog.categories.update', description: 'Editar categorías' },
  { code: 'catalog.categories.deactivate', description: 'Desactivar y reactivar categorías' },
  { code: 'catalog.units.search', description: 'Consultar las unidades de medida' },
  { code: 'catalog.units.create', description: 'Crear unidades de medida' },
  { code: 'catalog.units.update', description: 'Editar unidades de medida' },
  { code: 'catalog.units.deactivate', description: 'Desactivar y reactivar unidades de medida' },
  { code: 'catalog.taxes.search', description: 'Consultar los impuestos' },
  { code: 'catalog.taxes.create', description: 'Crear impuestos' },
  { code: 'catalog.taxes.update', description: 'Editar impuestos y su porcentaje' },
  { code: 'catalog.taxes.deactivate', description: 'Desactivar y reactivar impuestos' },
  { code: 'catalog.warehouses.search', description: 'Consultar las bodegas' },
  { code: 'catalog.warehouses.create', description: 'Crear bodegas' },
  { code: 'catalog.warehouses.update', description: 'Editar bodegas y elegir la bodega por defecto' },
  { code: 'catalog.warehouses.deactivate', description: 'Desactivar y reactivar bodegas' },
  { code: 'catalog.items.search', description: 'Consultar los artículos' },
  { code: 'catalog.items.create', description: 'Crear artículos' },
  { code: 'catalog.items.update', description: 'Editar artículos y sus unidades' },
  { code: 'catalog.items.deactivate', description: 'Desactivar y reactivar artículos' },
];

export const INVENTORY_PERMISSIONS: PermissionDefinition[] = [
  { code: 'inventory.adjustments.search', description: 'Consultar los ajustes de inventario' },
  { code: 'inventory.adjustments.create', description: 'Crear ajustes en borrador' },
  { code: 'inventory.adjustments.update', description: 'Editar ajustes en borrador' },
  { code: 'inventory.adjustments.confirm', description: 'Confirmar ajustes: mueve la existencia' },
  { code: 'inventory.adjustments.cancel', description: 'Anular ajustes, revirtiendo lo que movieron' },
  { code: 'inventory.stock.search', description: 'Consultar las existencias por bodega' },
  { code: 'inventory.movements.search', description: 'Consultar el kardex de un artículo' },
];

export const PURCHASING_PERMISSIONS: PermissionDefinition[] = [
  { code: 'purchasing.suppliers.search', description: 'Consultar los proveedores' },
  { code: 'purchasing.suppliers.create', description: 'Crear proveedores' },
  { code: 'purchasing.suppliers.update', description: 'Editar proveedores' },
  { code: 'purchasing.suppliers.deactivate', description: 'Desactivar y reactivar proveedores' },
  { code: 'purchasing.orders.search', description: 'Consultar las órdenes de compra' },
  { code: 'purchasing.orders.create', description: 'Crear órdenes de compra en borrador' },
  { code: 'purchasing.orders.update', description: 'Editar órdenes de compra en borrador' },
  { code: 'purchasing.orders.confirm', description: 'Confirmar órdenes de compra: anuncia mercancía en camino' },
  { code: 'purchasing.orders.cancel', description: 'Anular órdenes de compra sin mercancía recibida' },
  { code: 'purchasing.receipts.search', description: 'Consultar las entradas de mercancía' },
  { code: 'purchasing.receipts.create', description: 'Crear entradas de mercancía en borrador' },
  { code: 'purchasing.receipts.update', description: 'Editar entradas de mercancía en borrador' },
  { code: 'purchasing.receipts.confirm', description: 'Confirmar entradas: sube la existencia' },
  { code: 'purchasing.receipts.cancel', description: 'Anular entradas, revirtiendo la existencia' },
  { code: 'purchasing.incoming.search', description: 'Consultar la mercancía en camino' },
];

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  ...ACCESS_PERMISSIONS,
  ...CATALOG_PERMISSIONS,
  ...INVENTORY_PERMISSIONS,
  ...PURCHASING_PERMISSIONS,
];

// Concede un permiso que no existe y la clave ajena lo rechazaria en la base con un
// error ilegible. Se comprueba antes, contra la unica fuente de verdad.
export function isKnownPermission(code: string): boolean {
  return SYSTEM_PERMISSIONS.some((permission) => permission.code === code);
}
