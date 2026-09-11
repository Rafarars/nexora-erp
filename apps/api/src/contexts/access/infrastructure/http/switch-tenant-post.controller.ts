import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { TenantSwitcher } from '../../application/switch-tenant/tenant-switcher.js';
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
  @AuthenticatedOnly()
  async run(
    @Session() current: CurrentSession,
    @Body(new ZodValidationPipe(switchTenantRequestSchema))
    body: SwitchTenantRequestDto,
  ): Promise<SessionResponseDto> {
    // El usuario lo resolvio el guardian a partir del token, nunca viene en el cuerpo:
    // si no, cualquiera pediria una sesion a nombre de otro.
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
