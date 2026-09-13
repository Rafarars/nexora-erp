export interface Role {
  id: string;
  name: string;
  grantsAll: boolean;
  permissions: string[];
}

export interface Permission {
  code: string;
  description: string;
  module: string;
}

// El prefijo del codigo es tecnico; lo que lee una persona es el nombre del modulo.
const MODULE_LABELS: Record<string, string> = {
  access: 'Acceso y administración',
  catalog: 'Catálogo',
  inventory: 'Inventario',
  purchasing: 'Compras',
};

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module;
}

// La interfaz pinta las casillas agrupadas: treinta permisos en una lista plana no
// hay quien los lea.
export function groupByModule(permissions: Permission[]): Map<string, Permission[]> {
  const grouped = new Map<string, Permission[]>();

  for (const permission of permissions) {
    grouped.set(permission.module, [...(grouped.get(permission.module) ?? []), permission]);
  }

  return grouped;
}
