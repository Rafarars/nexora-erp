import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC,
} from '../../../../shared/infrastructure/http/public.decorator.js';
import {
  AUTHENTICATED_ONLY,
} from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import {
  REQUIRED_PERMISSION,
} from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { NotFoundError } from '../../../../shared/domain/domain.error.js';
import { SignInPolicy } from '../../domain/authenticate/sign-in-policy.js';
import { PermissionChecker } from '../../domain/authorize/permission-checker.js';
import { ContradictoryDeclarationError } from '../../domain/errors/contradictory-declaration.error.js';
import { UndeclaredEndpointError } from '../../domain/errors/undeclared-endpoint.error.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { PermissionCode } from '../../domain/role/permission-code.vo.js';
import { ROLE_REPOSITORY } from '../../domain/role/role.repository.js';
import type { RoleRepository } from '../../domain/role/role.repository.js';
import { TenantFinder } from '../../domain/tenant/find/tenant-finder.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserFinder } from '../../domain/user/find/user-finder.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { InvalidTokenError } from '../security/invalid-token.error.js';
import { TOKEN_ISSUER } from '../security/token-issuer.js';
import type { TokenIssuer } from '../security/token-issuer.js';

// Deniega por defecto. Un endpoint sin declaracion NO se abre "porque nadie dijo lo
// contrario": se rechaza, y hay una prueba que recorre todas las rutas para que
// ninguna llegue a produccion sin decidirlo.
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
    private readonly users: UserFinder,
    private readonly tenants: TenantFinder,
    private readonly memberships: MembershipFinder,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = [context.getHandler(), context.getClass()];

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, handler);
    const permission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, handler);
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(
      AUTHENTICATED_ONLY,
      handler,
    );

    // Las tres declaraciones se leen ANTES de decidir. Si se comprobara `@Public()`
    // primero y se saliera, un `@Public()` en la clase abriria en silencio un metodo
    // que exige permiso: los decoradores de clase y de metodo conviven, no se anulan.
    const declarations = [isPublic, permission, authenticatedOnly].filter(Boolean).length;

    if (declarations === 0) {
      throw new UndeclaredEndpointError(context.getClass().name);
    }

    // Declaraciones que se contradicen se resuelven cerrando, no abriendo: quien
    // escribio las dos no sabe cual gana, y adivinar por el sería como abrirla.
    if (declarations > 1) {
      throw new ContradictoryDeclarationError(context.getClass().name);
    }

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // En dos pasos a proposito: falta de cabecera y token invalido son fallos
    // distintos, y encadenarlos haria depender el primero del orden de evaluacion.
    const token = bearerFrom(request.headers.authorization);
    const claims = await this.tokens.verify(token);

    const userId = UserId.of(claims.userId);
    const tenantId = TenantId.of(claims.tenantId);

    // Se comprueba contra la base, no contra el token: revocar un acceso tiene efecto
    // de inmediato en vez de esperar a que caduque la sesion.
    //
    // Que el usuario, la empresa o la membresia ya no existan NO es un 404: el
    // recurso pedido existe, lo que no vale es la sesion. Responder 404 ademas
    // filtraria identificadores internos en el mensaje.
    const { user, tenant, membership } = await this.resolveIdentity(userId, tenantId);

    SignInPolicy.ensureCanSignIn(user, tenant, membership);

    if (permission) {
      const roles = await this.roles.searchByIds(tenantId, membership.roles());

      PermissionChecker.ensureCan(roles, tenantId, PermissionCode.of(permission));
    }

    request.session = { userId: claims.userId, tenantId: claims.tenantId };

    return true;
  }
  private async resolveIdentity(userId: UserId, tenantId: TenantId) {
    try {
      return {
        user: await this.users.find(userId),
        tenant: await this.tenants.find(tenantId),
        membership: await this.memberships.findByUser(tenantId, userId),
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new InvalidTokenError();
      }

      throw error;
    }
  }
}

function bearerFrom(authorization: string | undefined): string {
  const [scheme, token] = (authorization ?? '').split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new InvalidTokenError();
  }

  return token;
}
