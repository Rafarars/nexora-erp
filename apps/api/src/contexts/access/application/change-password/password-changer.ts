import { Clock } from '../../../../shared/domain/ports/clock.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { TenantFinder } from '../../domain/tenant/find/tenant-finder.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { AccessSessionBuilder } from '../session/access-session-builder.js';
import { AccessSessionResponse } from '../session/access-session.response.js';
import { WrongCurrentPasswordError } from '../../domain/errors/wrong-current-password.error.js';
import { UserFinder } from '../../domain/user/find/user-finder.js';
import { PasswordHash } from '../../domain/user/password-hash.vo.js';
import { PasswordHasher } from '../../domain/user/password-hasher.js';
import { PlainPassword } from '../../domain/user/plain-password.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { UserRepository } from '../../domain/user/user.repository.js';

export class PasswordChanger {
  constructor(
    private readonly finder: UserFinder,
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tenants: TenantFinder,
    private readonly memberships: MembershipFinder,
    private readonly session: AccessSessionBuilder,
    private readonly clock: Clock,
  ) {}

  // Devuelve la sesion para que se reemita el token: cambiar la contrasena cierra TODAS
  // las abiertas, y sin esto quien la cambia se echaria a si mismo.
  async run(request: {
    userId: string;
    tenantId: string;
    current: string;
    next: string;
  }): Promise<AccessSessionResponse> {
    const user = await this.finder.find(UserId.of(request.userId));

    // Se exige la contrasena actual: si no, quien se siente ante una sesion abierta
    // podria cambiarla y dejar fuera a su dueno.
    const matches = await this.hasher.verify(request.current, user.currentPasswordHash().value);

    if (!matches) {
      throw new WrongCurrentPasswordError();
    }

    const next = PlainPassword.of(request.next);

    // La empresa y la membresia se buscan ANTES de guardar: si faltan, la respuesta seria
    // un error con la contrasena ya cambiada y la vieja inservible.
    const tenantId = TenantId.of(request.tenantId);
    const tenant = await this.tenants.find(tenantId);
    const membership = await this.memberships.findByUser(tenantId, UserId.of(request.userId));

    user.changePassword(PasswordHash.of(await this.hasher.hash(next.value)), this.clock.now());

    await this.users.save(user);

    return this.session.build(user, tenant, membership);
  }
}
