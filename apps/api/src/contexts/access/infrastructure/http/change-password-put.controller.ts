import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { PasswordChanger } from '../../application/change-password/password-changer.js';
import { passwordRequestSchema } from './dto/password.request.dto.js';
import type { PasswordRequestDto } from './dto/password.request.dto.js';

@Controller('api/v1/auth')
export class ChangePasswordPutController {
  constructor(private readonly changer: PasswordChanger) {}

  @Put('password')
  @HttpCode(HttpStatus.OK)
  @AuthenticatedOnly()
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(passwordRequestSchema)) body: PasswordRequestDto,
  ): Promise<void> {
    await this.changer.run({ userId: session.userId, ...body });
  }
}
