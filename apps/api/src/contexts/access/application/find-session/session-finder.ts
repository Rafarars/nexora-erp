import { SignInPolicy } from '../../domain/authenticate/sign-in-policy.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { TenantFinder } from '../../domain/tenant/find/tenant-finder.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserFinder } from '../../domain/user/find/user-finder.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { AccessSessionBuilder } from '../session/access-session-builder.js';
import { AccessSessionResponse } from '../session/access-session.response.js';

// Quien soy y que puedo hacer AHORA. La interfaz lo pide en cada pantalla en vez de
// fiarse de lo que guardo al entrar: si le quitan un rol, se nota al momento.
// No reemite token: alargar la sesion en cada carga la volveria eterna.
export class SessionFinder {
  constructor(
    private readonly users: UserFinder,
    private readonly tenants: TenantFinder,
    private readonly memberships: MembershipFinder,
    private readonly session: AccessSessionBuilder,
  ) {}

  async run(request: { userId: string; tenantId: string }): Promise<AccessSessionResponse> {
    const userId = UserId.of(request.userId);
    const tenantId = TenantId.of(request.tenantId);

    const user = await this.users.find(userId);
    const tenant = await this.tenants.find(tenantId);
    const membership = await this.memberships.findByUser(tenantId, userId);

    SignInPolicy.ensureCanSignIn(user, tenant, membership);

    return this.session.build(user, tenant, membership);
  }
}
