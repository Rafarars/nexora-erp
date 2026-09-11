import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { DuplicateRoleNameError } from '../../domain/errors/duplicate-role-name.error.js';
import { PermissionCode } from '../../domain/role/permission-code.vo.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { RoleName } from '../../domain/role/role-name.vo.js';
import { Role } from '../../domain/role/role.entity.js';
import { RoleRepository } from '../../domain/role/role.repository.js';
import { CatalogPermissions } from '../../domain/role/catalog-permissions.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { RoleCreatorRequest } from './role-creator.request.js';

export class RoleCreator {
  constructor(
    private readonly roles: RoleRepository,
    private readonly catalog: CatalogPermissions,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: RoleCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const name = RoleName.of(request.name);

    // Dos roles con el mismo nombre en una empresa harian imposible saber cual se
    // esta asignando desde la interfaz.
    if (await this.roles.findByName(tenantId, name)) {
      throw new DuplicateRoleNameError(name.value, tenantId.value);
    }

    const permissions = this.catalog.ensureKnown(request.permissions);

    await this.roles.save(
      Role.create(
        RoleId.of(this.ids.next()),
        tenantId,
        name,
        permissions.map((code) => PermissionCode.of(code)),
        this.clock.now(),
      ),
    );
  }
}
