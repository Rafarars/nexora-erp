import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { Session } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import type { CurrentSession } from '../../../../shared/infrastructure/http/current-session.decorator.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/zod-validation.pipe.js';
import { MembershipStatusChanger } from '../../application/change-membership-status/membership-status-changer.js';
import { membershipStatusRequestSchema } from './dto/membership-status.request.dto.js';
import type { MembershipStatusRequestDto } from './dto/membership-status.request.dto.js';

@Controller('api/v1/users')
export class ChangeMembershipStatusPutController {
  constructor(private readonly changer: MembershipStatusChanger) {}

  @Put(':userId/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('access.users.deactivate')
  async run(
    @Session() session: CurrentSession,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(membershipStatusRequestSchema)) body: MembershipStatusRequestDto,
  ): Promise<void> {
    await this.changer.run({
      tenantId: session.tenantId,
      actorId: session.userId,
      userId,
      active: body.active,
    });
  }
}
