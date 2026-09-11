import { UnknownPermissionError } from '../errors/unknown-permission.error.js';
import { ACCESS_PERMISSIONS, isKnownPermission } from './permissions.catalog.js';
import type { PermissionDefinition } from './permissions.catalog.js';

// Los permisos que se pueden conceder. Vive en el dominio porque es una regla de
// negocio —que permisos existen—, no un detalle de almacenamiento.
export class CatalogPermissions {
  all(): PermissionDefinition[] {
    return [...ACCESS_PERMISSIONS];
  }

  ensureKnown(codes: string[]): string[] {
    for (const code of codes) {
      if (!isKnownPermission(code)) {
        throw new UnknownPermissionError(code);
      }
    }

    return [...new Set(codes)];
  }
}
