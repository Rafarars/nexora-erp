import { CatalogPermissions } from '../../domain/role/catalog-permissions.js';

export interface PermissionSearcherResponse {
  permissions: { code: string; description: string; module: string }[];
}

// El catalogo que la interfaz pinta como casillas. Se lee del codigo, que es la
// fuente de verdad; la base solo lo replica para las claves ajenas.
export class PermissionSearcher {
  constructor(private readonly catalog: CatalogPermissions) {}

  async run(): Promise<PermissionSearcherResponse> {
    return {
      permissions: this.catalog.all().map((permission) => ({
        ...permission,
        // `access.users.create` se agrupa bajo `access`: la interfaz las muestra por
        // modulo en vez de como una lista plana de treinta casillas.
        module: permission.code.split('.')[0],
      })),
    };
  }
}
