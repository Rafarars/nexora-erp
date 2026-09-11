import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { UserCreator } from '../../application/create-user/user-creator.js';
import { createUserRequestSchema } from './dto/create-user.request.dto.js';
import type { CreateUserRequestDto } from './dto/create-user.request.dto.js';

@Controller('api/v1/users')
export class CreateUserPostController {
  constructor(private readonly creator: UserCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('access.users.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(createUserRequestSchema))
    body: CreateUserRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
