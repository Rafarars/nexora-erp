import { Body, Controller, HttpCode, HttpStatus, Inject, Put } from '@nestjs/common';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PasswordChanger } from '../../application/change-password/password-changer.js';
import { TOKEN_ISSUER } from '../security/token-issuer.js';
import type { TokenIssuer } from '../security/token-issuer.js';
import { toSessionResponse } from './dto/session.response.dto.js';
import type { SessionResponseDto } from './dto/session.response.dto.js';
import { passwordRequestSchema } from './dto/password.request.dto.js';
import type { PasswordRequestDto } from './dto/password.request.dto.js';

@Controller('api/v1/auth')
export class ChangePasswordPutController {
  constructor(
    private readonly changer: PasswordChanger,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
  ) {}

  // Cambiar la contrasena cierra TODAS las sesiones, incluida esta. Se devuelve una nueva
  // para que quien la cambio siga dentro y solo caigan los demas dispositivos.
  @Put('password')
  @HttpCode(HttpStatus.OK)
  @AuthenticatedOnly()
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(passwordRequestSchema)) body: PasswordRequestDto,
  ): Promise<SessionResponseDto> {
    const reissued = await this.changer.run({
      userId: session.userId,
      tenantId: session.tenantId,
      ...body,
    });

    return toSessionResponse(
      reissued,
      await this.tokens.issue({
        userId: reissued.userId,
        tenantId: reissued.tenantId,
        permissions: reissued.permissions,
        grantsAll: reissued.grantsAll,
      }),
    );
  }
}
