import { PermissionDeniedError } from '../errors/permission-denied.error.js';
import { TenantId } from '../tenant/tenant-id.vo.js';
import { PermissionCode } from '../role/permission-code.vo.js';
import { Role } from '../role/role.entity.js';

export class PermissionChecker {
  // Falla en cerrado: sin roles, sin permiso. Y un rol de otra empresa no cuenta
  // aunque lo conceda, para que `grantsAll` no se convierta en un pase global.
  static can(roles: Role[], tenantId: TenantId, permission: PermissionCode): boolean {
    return roles.some((role) => role.belongsTo(tenantId) && role.grants(permission));
  }

  static ensureCan(roles: Role[], tenantId: TenantId, permission: PermissionCode): void {
    if (!PermissionChecker.can(roles, tenantId, permission)) {
      throw new PermissionDeniedError(permission.value);
    }
  }

  // Para la interfaz, no para decidir accesos: el guardian siempre pregunta por un
  // permiso concreto con `can()`, nunca confia en esta marca.
  static grantsEverything(roles: Role[], tenantId: TenantId): boolean {
    return roles.some((role) => role.belongsTo(tenantId) && role.grantsEverything());
  }

  // Los permisos que viajan en el token. Un rol con `grantsAll` no se expande a una
  // lista: el guardian consulta al dominio, no al token.
  static effectivePermissions(roles: Role[], tenantId: TenantId): string[] {
    const codes = roles
      .filter((role) => role.belongsTo(tenantId))
      .flatMap((role) => role.permissionCodes())
      .map((code) => code.value);

    return [...new Set(codes)].sort();
  }
}
