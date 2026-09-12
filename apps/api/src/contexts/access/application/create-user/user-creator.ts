import { MemberEnroller } from '../../domain/membership/enroll/member-enroller.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { RoleFinder } from '../../domain/role/find/role-finder.js';
import { TenantFinder } from '../../domain/tenant/find/tenant-finder.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { Email } from '../../domain/user/email.vo.js';
import { UserRegistrar } from '../../domain/user/register/user-registrar.js';
import { PlainPassword } from '../../domain/user/plain-password.vo.js';
import { UserName } from '../../domain/user/user-name.vo.js';
import { UserCreatorRequest } from './user-creator.request.js';

// Dar de alta a alguien en una empresa son dos cosas: la persona y su membresia.
// Aqui solo se ordenan; cada regla vive en su servicio de dominio.
export class UserCreator {
  constructor(
    private readonly tenants: TenantFinder,
    private readonly roles: RoleFinder,
    private readonly registrar: UserRegistrar,
    private readonly enroller: MemberEnroller,
  ) {}

  async run(request: UserCreatorRequest): Promise<void> {
    const tenant = await this.tenants.find(TenantId.of(request.tenantId));

    // Los roles se validan antes de escribir nada: un fallo a mitad dejaria una
    // persona registrada y sin empresa.
    const roles = await this.roles.findAll(
      tenant.id,
      (request.roleIds ?? []).map((id) => RoleId.of(id)),
    );

    // Se valida antes de escribir nada, junto con los roles.
    const password = PlainPassword.of(request.password);

    const user = await this.registrar.register(
      Email.of(request.email),
      password,
      UserName.of(request.name),
    );

    await this.enroller.enroll(user, tenant, roles);
  }
}
