import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { ProfileUpdater } from '../../application/update-profile/profile-updater.js';
import { profileRequestSchema } from './dto/profile.request.dto.js';
import type { ProfileRequestDto } from './dto/profile.request.dto.js';

@Controller('api/v1/auth')
export class UpdateProfilePutController {
  constructor(private readonly updater: ProfileUpdater) {}

  // Ningun permiso: cada quien cambia lo suyo, y el identificador sale de la sesion.
  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @AuthenticatedOnly()
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(profileRequestSchema)) body: ProfileRequestDto,
  ): Promise<void> {
    await this.updater.run({ userId: session.userId, name: body.name });
  }
}
