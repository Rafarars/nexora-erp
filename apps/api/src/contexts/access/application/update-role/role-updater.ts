import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DuplicateRoleNameError } from '../../domain/errors/duplicate-role-name.error.js';
import { CatalogPermissions } from '../../domain/role/catalog-permissions.js';
import { RoleFinder } from '../../domain/role/find/role-finder.js';
import { PermissionCode } from '../../domain/role/permission-code.vo.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { RoleName } from '../../domain/role/role-name.vo.js';
import { RoleRepository } from '../../domain/role/role.repository.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { RoleUpdaterRequest } from './role-updater.request.js';

// Cambiar los permisos de un rol cambia lo que puede hacer TODO el que lo tenga. Es
// la pieza que hace que quitar un permiso sea un par de clics y no una migracion.
export class RoleUpdater {
  constructor(
    private readonly finder: RoleFinder,
    private readonly roles: RoleRepository,
    private readonly catalog: CatalogPermissions,
    private readonly clock: Clock,
  ) {}

  async run(request: RoleUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const role = await this.finder.find(tenantId, RoleId.of(request.roleId));

    const name = RoleName.of(request.name);
    const withSameName = await this.roles.findByName(tenantId, name);

    if (withSameName && !withSameName.id.equals(role.id)) {
      throw new DuplicateRoleNameError(name.value, tenantId.value);
    }

    const wanted = this.catalog.ensureKnown(request.permissions);
    const now = this.clock.now();

    role.rename(name, now);

    // Se reemplaza el conjunto entero: la interfaz manda las casillas marcadas, no
    // una lista de cambios.
    for (const granted of role.permissionCodes()) {
      if (!wanted.includes(granted.value)) {
        role.revoke(granted, now);
      }
    }

    for (const code of wanted) {
      role.grant(PermissionCode.of(code), now);
    }

    await this.roles.save(role);
  }
}
