import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { TenantUserUpdater } from '../../application/update-tenant-user/tenant-user-updater.js';
import { updateTenantUserRequestSchema } from './dto/update-tenant-user.request.dto.js';
import type { UpdateTenantUserRequestDto } from './dto/update-tenant-user.request.dto.js';

@Controller('api/v1/users')
export class UpdateTenantUserPutController {
  constructor(private readonly updater: TenantUserUpdater) {}

  @Put(':userId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('access.users.update')
  async run(
    @Session() session: CurrentSession,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateTenantUserRequestSchema)) body: UpdateTenantUserRequestDto,
  ): Promise<void> {
    await this.updater.run({ ...body, userId, tenantId: session.tenantId });
  }
}
