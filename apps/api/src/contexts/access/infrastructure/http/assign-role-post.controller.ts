import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { RoleAssigner } from '../../application/assign-role/role-assigner.js';
import { assignRoleRequestSchema } from './dto/assign-role.request.dto.js';
import type { AssignRoleRequestDto } from './dto/assign-role.request.dto.js';

@Controller('api/v1/roles')
export class AssignRolePostController {
  constructor(private readonly assigner: RoleAssigner) {}

  @Post('assignments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('access.roles.assign')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(assignRoleRequestSchema))
    body: AssignRoleRequestDto,
  ): Promise<void> {
    await this.assigner.run({ ...body, tenantId: session.tenantId });
  }
}
