import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { UserAuthenticator } from '../../application/authenticate-user/user-authenticator.js';
import { TOKEN_ISSUER } from '../security/token-issuer.js';
import type { TokenIssuer } from '../security/token-issuer.js';
import { loginRequestSchema } from './dto/login.request.dto.js';
import type { LoginRequestDto } from './dto/login.request.dto.js';
import { toSessionResponse } from './dto/session.response.dto.js';
import type { SessionResponseDto } from './dto/session.response.dto.js';

// Un controlador POR ACCION. Aqui se decide que la sesion viaja como token; el caso
// de uso no sabe que existe un JWT.
@Controller('api/v1/auth')
export class LoginPostController {
  constructor(
    private readonly authenticator: UserAuthenticator,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginRequestSchema))
  async run(@Body() body: LoginRequestDto): Promise<SessionResponseDto> {
    const session = await this.authenticator.run(body);

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
