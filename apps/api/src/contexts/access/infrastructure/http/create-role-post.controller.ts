import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { RoleCreator } from '../../application/create-role/role-creator.js';
import { roleRequestSchema } from './dto/role.request.dto.js';
import type { RoleRequestDto } from './dto/role.request.dto.js';

@Controller('api/v1/roles')
export class CreateRolePostController {
  constructor(private readonly creator: RoleCreator) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('access.roles.create')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(roleRequestSchema)) body: RoleRequestDto,
  ): Promise<void> {
    await this.creator.run({ ...body, tenantId: session.tenantId });
  }
}
