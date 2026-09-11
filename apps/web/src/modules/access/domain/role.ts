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

// La interfaz pinta las casillas agrupadas: treinta permisos en una lista plana no
// hay quien los lea.
export function groupByModule(permissions: Permission[]): Map<string, Permission[]> {
  const grouped = new Map<string, Permission[]>();

  for (const permission of permissions) {
    grouped.set(permission.module, [...(grouped.get(permission.module) ?? []), permission]);
  }

  return grouped;
}
