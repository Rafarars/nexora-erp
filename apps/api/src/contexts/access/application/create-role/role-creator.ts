import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { ActorAuthority } from '../authority/actor-authority.js';
import { GrantPolicy } from '../../domain/authorize/grant-policy.js';
import { DuplicateRoleNameError } from '../../domain/errors/duplicate-role-name.error.js';
import { RoleWithoutPermissionsError } from '../../domain/errors/role-without-permissions.error.js';
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
    private readonly authority: ActorAuthority,
    private readonly clock: Clock,
  ) {}

  async run(request: RoleCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);

    if (request.permissions.length === 0) {
      throw new RoleWithoutPermissionsError();
    }

    const name = RoleName.of(request.name);

    // Dos roles con el mismo nombre en una empresa harian imposible saber cual se
    // esta asignando desde la interfaz.
    if (await this.roles.findByName(tenantId, name)) {
      throw new DuplicateRoleNameError(name.value, tenantId.value);
    }

    const permissions = this.catalog.ensureKnown(request.permissions);

    // Crear un rol con mas de lo que uno tiene y asignarselo despues llega al mismo sitio.
    GrantPolicy.ensureWithinReach(
      tenantId,
      await this.authority.of(tenantId, request.actorId),
      permissions,
    );

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
