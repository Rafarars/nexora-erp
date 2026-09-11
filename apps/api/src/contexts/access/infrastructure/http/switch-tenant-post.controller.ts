import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { TenantSwitcher } from '../../application/switch-tenant/tenant-switcher.js';
import { InvalidTokenError } from '../security/invalid-token.error.js';
import { TOKEN_ISSUER } from '../security/token-issuer.js';
import type { TokenIssuer } from '../security/token-issuer.js';
import { toSessionResponse } from './dto/session.response.dto.js';
import type { SessionResponseDto } from './dto/session.response.dto.js';
import { switchTenantRequestSchema } from './dto/switch-tenant.request.dto.js';
import type { SwitchTenantRequestDto } from './dto/switch-tenant.request.dto.js';

@Controller('api/v1/auth')
export class SwitchTenantPostController {
  constructor(
    private readonly switcher: TenantSwitcher,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
  ) {}

  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(switchTenantRequestSchema))
  async run(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SwitchTenantRequestDto,
  ): Promise<SessionResponseDto> {
    // Leer la cabecera aqui es provisional: en la fase 6 esto lo hace un guardian y
    // el controlador recibe la identidad ya resuelta.
    const current = await this.tokens.verify(bearerFrom(authorization));

    // El usuario es el del token, nunca uno que venga en el cuerpo: si no, cualquiera
    // pediria una sesion a nombre de otro.
    const session = await this.switcher.run({
      userId: current.userId,
      tenantId: body.tenantId,
    });

    return toSessionResponse(
      session,
      await this.tokens.issue({
        userId: session.userId,
        tenantId: session.tenantId,
        permissions: session.permissions,
        grantsAll: session.grantsAll,
      }),
    );
  }
}

function bearerFrom(authorization: string | undefined): string {
  const [scheme, token] = (authorization ?? '').split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new InvalidTokenError();
  }

  return token;
}
