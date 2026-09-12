import { LoginAttempts } from '../../domain/authenticate/login-attempts.js';
import { SignInPolicy } from '../../domain/authenticate/sign-in-policy.js';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error.js';
import { TooManyLoginAttemptsError } from '../../domain/errors/too-many-login-attempts.error.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { TenantSlug } from '../../domain/tenant/tenant-slug.vo.js';
import { Tenant } from '../../domain/tenant/tenant.entity.js';
import { TenantRepository } from '../../domain/tenant/tenant.repository.js';
import { Email } from '../../domain/user/email.vo.js';
import { PasswordHasher } from '../../domain/user/password-hasher.js';
import { User } from '../../domain/user/user.entity.js';
import { UserRepository } from '../../domain/user/user.repository.js';
import { AccessSessionBuilder } from '../session/access-session-builder.js';
import { AccessSessionResponse } from '../session/access-session.response.js';
import { UserAuthenticatorRequest } from './user-authenticator.request.js';

export class UserAuthenticator {
  constructor(
    private readonly users: UserRepository,
    private readonly tenants: TenantRepository,
    private readonly memberships: MembershipRepository,
    private readonly hasher: PasswordHasher,
    private readonly session: AccessSessionBuilder,
    private readonly attempts: LoginAttempts,
  ) {}

  async run(request: UserAuthenticatorRequest): Promise<AccessSessionResponse> {
    const email = Email.of(request.email);

    // Antes de verificar: una cuenta bloqueada no gasta ni un calculo de Argon2, y
    // quien prueba contrasenas no puede saber si la ultima era la buena.
    if (await this.attempts.isLocked(email)) {
      throw new TooManyLoginAttemptsError();
    }

    const user = await this.users.findByEmail(email);

    // Se verifica la contrasena aunque el usuario no exista: el hasher usa un hash de
    // relleno y tarda lo mismo, asi el tiempo no delata que correos estan registrados.
    const hash = user?.currentPasswordHash().value ?? '';
    const matches = await this.hasher.verify(request.password, hash);

    if (!user || !matches) {
      await this.attempts.recordFailure(email);
      throw new InvalidCredentialsError();
    }

    await this.attempts.reset(email);

    const tenant = await this.resolveTenant(user, request.tenantSlug);
    const membership = await this.memberships.findByUser(tenant.id, user.id);

    if (!membership) {
      throw new InvalidCredentialsError();
    }

    SignInPolicy.ensureCanSignIn(user, tenant, membership);

    return this.session.build(user, tenant, membership);
  }

  private async resolveTenant(user: User, slug?: string): Promise<Tenant> {
    if (slug) {
      const requested = await this.tenants.findBySlug(TenantSlug.of(slug));

      // Una empresa que no existe se responde igual que unas credenciales malas: no
      // se confirma que empresas hay ni a cuales pertenece este usuario.
      if (!requested) {
        throw new InvalidCredentialsError();
      }

      return requested;
    }

    const memberships = await this.memberships.searchByUser(user.id);
    const first = memberships.find((membership) => membership.isActive());
    const tenant = first ? await this.tenants.find(first.tenantId) : null;

    if (!tenant) {
      throw new InvalidCredentialsError();
    }

    return tenant;
  }
}
