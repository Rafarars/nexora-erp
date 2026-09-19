import { CannotGrantSelfMoreAccessError } from '../errors/cannot-grant-self-more-access.error.js';
import { Role } from '../role/role.entity.js';
import { TenantId } from '../tenant/tenant-id.vo.js';
import { PermissionChecker } from './permission-checker.js';

export class SelfEscalationPolicy {
  // Al cambiar sus PROPIOS roles, lo que queda tiene que caber en lo que ya tenia. Quien
  // administra no se ve afectado porque ya lo tiene todo, y cambiar los roles de otra
  // persona tampoco: lo que se protege es ascenderse uno mismo.
  static ensureGrantsNothingNew(tenantId: TenantId, current: Role[], next: Role[]): void {
    if (PermissionChecker.grantsEverything(current, tenantId)) {
      return;
    }

    if (PermissionChecker.grantsEverything(next, tenantId)) {
      throw new CannotGrantSelfMoreAccessError();
    }

    const had = new Set(PermissionChecker.effectivePermissions(current, tenantId));
    const gained = PermissionChecker.effectivePermissions(next, tenantId).filter(
      (code) => !had.has(code),
    );

    if (gained.length > 0) {
      throw new CannotGrantSelfMoreAccessError();
    }
  }
}
