import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { EmailChanger } from '../../application/change-email/email-changer.js';
import { emailRequestSchema } from './dto/email.request.dto.js';
import type { EmailRequestDto } from './dto/email.request.dto.js';

@Controller('api/v1/auth')
export class ChangeEmailPutController {
  constructor(private readonly changer: EmailChanger) {}

  // Sin permiso concreto: cada quien cambia lo suyo, y la persona sale de la sesion.
  @Put('email')
  @HttpCode(HttpStatus.OK)
  @AuthenticatedOnly()
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(emailRequestSchema)) body: EmailRequestDto,
  ): Promise<void> {
    await this.changer.run({ userId: session.userId, ...body });
  }
}
