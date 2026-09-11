import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { RoleUpdater } from '../../application/update-role/role-updater.js';
import { roleRequestSchema } from './dto/role.request.dto.js';
import type { RoleRequestDto } from './dto/role.request.dto.js';

@Controller('api/v1/roles')
export class UpdateRolePutController {
  constructor(private readonly updater: RoleUpdater) {}

  @Put(':roleId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('access.roles.update')
  async run(
    @Session() session: CurrentSession,
    @Param('roleId') roleId: string,
    @Body(new ZodValidationPipe(roleRequestSchema)) body: RoleRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, roleId, tenantId: session.tenantId });
  }
}
