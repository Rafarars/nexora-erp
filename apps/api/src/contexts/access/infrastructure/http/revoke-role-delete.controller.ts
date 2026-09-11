import { Body, Controller, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { RoleRevoker } from '../../application/revoke-role/role-revoker.js';
import { revokeRoleRequestSchema } from './dto/revoke-role.request.dto.js';
import type { RevokeRoleRequestDto } from './dto/revoke-role.request.dto.js';

@Controller('api/v1/roles')
export class RevokeRoleDeleteController {
  constructor(private readonly revoker: RoleRevoker) {}

  // Mismo permiso que asignar: quien reparte roles es quien los retira.
  @Delete('assignments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('access.roles.assign')
  async run(
    @Session() session: CurrentSession,
    @Body(new ZodValidationPipe(revokeRoleRequestSchema)) body: RevokeRoleRequestDto,
  ): Promise<void> {
    await this.revoker.run({ ...body, tenantId: session.tenantId });
  }
}
