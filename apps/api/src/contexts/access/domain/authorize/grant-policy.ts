import { CannotGrantSelfMoreAccessError } from '../errors/cannot-grant-self-more-access.error.js';
import { PermissionCode } from '../role/permission-code.vo.js';
import { Role } from '../role/role.entity.js';
import { TenantId } from '../tenant/tenant-id.vo.js';
import { PermissionChecker } from './permission-checker.js';

// Nadie concede lo que no tiene, NI A SI MISMO NI A OTRO. Mirar solo el caso propio
// dejaba dos puertas al mismo sitio: ampliar el rol que uno mismo lleva, y dar de alta a
// una cuenta titere con el rol que lo concede todo para entrar con ella.
export class GrantPolicy {
  // Quien lo concede todo no se ve afectado: no hay nada fuera de su alcance.
  static ensureWithinReach(tenantId: TenantId, actor: Role[], codes: string[]): void {
    if (PermissionChecker.grantsEverything(actor, tenantId)) {
      return;
    }

    const reachable = new Set(PermissionChecker.effectivePermissions(actor, tenantId));

    if (codes.some((code) => !reachable.has(code))) {
      throw new CannotGrantSelfMoreAccessError();
    }
  }

  // Lo mismo para un conjunto de roles: un rol que lo concede todo solo lo reparte quien
  // ya lo tiene, y uno normal solo si cada permiso suyo esta al alcance de quien reparte.
  static ensureRolesWithinReach(tenantId: TenantId, actor: Role[], granted: Role[]): void {
    if (PermissionChecker.grantsEverything(actor, tenantId)) {
      return;
    }

    if (PermissionChecker.grantsEverything(granted, tenantId)) {
      throw new CannotGrantSelfMoreAccessError();
    }

    GrantPolicy.ensureWithinReach(
      tenantId,
      actor,
      PermissionChecker.effectivePermissions(granted, tenantId),
    );
  }

  static codesOf(permissions: PermissionCode[]): string[] {
    return permissions.map((permission) => permission.value);
  }
}
